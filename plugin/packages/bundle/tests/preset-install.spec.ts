/**
 * [INPUT]: 依赖 node:fs/promises/node:path、vitest，以及 src/preset 的安装段与 tests/preset-support 的假端口夹具
 * [OUTPUT]: 用**假安装端口**覆盖官方安装面的一切内部分支——成功（热）、成功（需重启）、拒绝、官方抛错原样保留、官方 failed、取消、重复点幂等、进行中拒绝、失败不禁用；卸载与 `node_modules` link 残壳清理（只清指向我们的、不动别人的、不删官方日志）；以及官方端口投影与 ctx 可达性
 * [POS]: 配方纵深「安装/卸载」段门禁 —— 本刀不把真官方安装面接进 vitest（那要另起 Host）；真安装由 `tests/preset-e2e.spec.ts` 在一次性临时 profile 上实测（默认跳过），这里锁编排语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, realpath, rm, stat, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanPresetBundleLink,
  createEnterprisePresetInstall,
  officialPresetInstallPort,
  officialPresetInstallPortFromContext,
  presetBundleRoot,
  presetBundleSetFingerprint,
  presetLinkExists,
  presetPluginManagerFromContext,
  presetProfileDirFromContext,
  readInstalledPresets,
  renderPresetBundle,
  authorizePreset,
  type PresetRecipe,
} from '../src/preset/index.js'
import {
  FULL_RECIPE_YML,
  appliedResult,
  cleanupPresetHomes,
  createFakePresetPort,
  makePresetHome,
  makeRecipe,
} from './preset-support.js'

const PACKAGE_NAME = 'dsh-ent-preset-ent-demo'

afterEach(cleanupPresetHomes)

async function makeRig(recipe: PresetRecipe = makeRecipe()): Promise<{
  readonly dshHome: string
  readonly profileDir: string
  readonly fake: ReturnType<typeof createFakePresetPort>
  readonly installer: ReturnType<typeof createEnterprisePresetInstall>
  readonly rendered: ReturnType<typeof renderPresetBundle>
  readonly errors: { message: string; error: unknown }[]
  readonly recipe: PresetRecipe
}> {
  const dshHome = await makePresetHome()
  const profileDir = join(dshHome, 'profile')
  await mkdir(join(profileDir, 'node_modules'), { recursive: true, mode: 0o700 })
  const fake = createFakePresetPort({ profileDir })
  const errors: { message: string; error: unknown }[] = []
  const installer = createEnterprisePresetInstall({
    dshHome,
    profileDir,
    port: fake.port,
    onError: (message, error) => { errors.push({ message, error }) },
  })
  const rendered = renderPresetBundle(recipe)
  return { dshHome, profileDir, fake, installer, rendered, errors, recipe }
}

async function authorize(rig: { dshHome: string; recipe: PresetRecipe }): Promise<string> {
  const rendered = renderPresetBundle(rig.recipe)
  const fingerprint = presetBundleSetFingerprint(rendered.bundleSet)
  await authorizePreset({ dshHome: rig.dshHome }, rendered.declarationId, fingerprint)
  return fingerprint
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('condition was never met')
}

describe('preset bundle install', () => {
  it('installs through the injected port and records the private state', async () => {
    const rig = await makeRig()
    await authorize(rig)
    const result = await rig.installer.enable(rig.recipe)
    expect(result).toMatchObject({
      ok: true,
      application: 'hot',
      officialApplication: 'applied',
      installedNames: [PACKAGE_NAME],
      needsNewSession: true,
      declarationId: 'ent-demo',
      rowId: 'preset-ent-demo',
    })
    expect(rig.fake.installCalls).toEqual([
      await realpath(join(presetBundleRoot({ dshHome: rig.dshHome }), 'ent-demo', rig.rendered.digest)),
    ])
    expect(await presetLinkExists(rig.profileDir, PACKAGE_NAME)).toBe(true)
    const records = await readInstalledPresets({ dshHome: rig.dshHome })
    expect(records).toEqual([expect.objectContaining({
      declarationId: 'ent-demo',
      displayName: '企业配方演示',
      packageName: PACKAGE_NAME,
      fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      officialApplication: 'applied',
    })])
  })

  it('passes the official restart-required outcome through honestly', async () => {
    const rig = await makeRig()
    rig.fake.installResult = appliedResult(PACKAGE_NAME, 'restart-required')
    await authorize(rig)
    await expect(rig.installer.enable(rig.recipe)).resolves.toMatchObject({
      ok: true,
      application: 'restart-required',
      officialApplication: 'restart-required',
      needsNewSession: true,
    })
  })

  it('refuses to install before the authorization gate is satisfied and still discloses', async () => {
    const rig = await makeRig()
    const result = await rig.installer.enable(rig.recipe)
    expect(result).toMatchObject({ ok: false, errorCode: 'ENT_PRESET_AUTHORIZATION_REQUIRED', application: 'other' })
    expect(rig.fake.installCalls).toEqual([])
    expect(result.disclosure?.bundles).toEqual([expect.objectContaining({ name: PACKAGE_NAME })])
  })

  it('re-confirms when the plugin set changed', async () => {
    const rig = await makeRig()
    await authorize(rig)
    const changed: PresetRecipe = { manifest: rig.recipe.manifest, agentCordisYml: FULL_RECIPE_YML }
    await expect(rig.installer.enable(changed)).resolves.toMatchObject({
      ok: false,
      errorCode: 'ENT_PRESET_AUTHORIZATION_STALE',
    })
    expect(rig.fake.installCalls).toEqual([])
  })

  it('does not install twice for a repeated click', async () => {
    const rig = await makeRig()
    await authorize(rig)
    await expect(rig.installer.enable(rig.recipe)).resolves.toMatchObject({ ok: true })
    await expect(rig.installer.enable(rig.recipe)).resolves.toMatchObject({ ok: true, alreadyInstalled: true, needsNewSession: true })
    expect(rig.fake.installCalls).toHaveLength(1)
  })

  it('rejects a second click while the first install is still running', async () => {
    const rig = await makeRig()
    await authorize(rig)
    let release!: () => void
    rig.fake.installGate = new Promise<void>(resolve => { release = resolve })
    const first = rig.installer.enable(rig.recipe)
    await waitFor(() => rig.fake.installCalls.length === 1)
    await expect(rig.installer.enable(rig.recipe)).resolves.toMatchObject({
      ok: false,
      errorCode: 'ENT_PRESET_INSTALL_IN_PROGRESS',
      application: 'other',
    })
    expect(rig.installer.busy('ent-demo')).toBe(true)
    release()
    await expect(first).resolves.toMatchObject({ ok: true })
    expect(rig.installer.busy()).toBe(false)
  })

  it('maps an official throw to a stable code and keeps the raw error on the host side', async () => {
    const rig = await makeRig()
    await authorize(rig)
    const boom = new Error('pnpm exploded')
    rig.fake.installError = boom
    const result = await rig.installer.enable(rig.recipe)
    expect(result).toMatchObject({ ok: false, errorCode: 'ENT_PRESET_INSTALL_FAILED', officialApplication: 'failed' })
    expect(rig.errors.at(-1)).toEqual({ message: 'preset bundle install failed', error: boom })
    await expect(readInstalledPresets({ dshHome: rig.dshHome })).resolves.toEqual([])
  })

  it('maps an official failed result, surfacing the controlled error code only', async () => {
    const rig = await makeRig()
    await authorize(rig)
    rig.fake.installResult = {
      target: PACKAGE_NAME,
      changed: false,
      application: 'failed',
      error: { code: 'operation-error', diagnostic: '/host/absolute/path leaked' },
    }
    const result = await rig.installer.enable(rig.recipe)
    expect(result).toMatchObject({
      ok: false,
      errorCode: 'ENT_PRESET_INSTALL_FAILED',
      officialApplication: 'failed',
      officialError: { code: 'operation-error' },
    })
    expect(JSON.stringify(result)).not.toContain('/host/absolute/path leaked')
  })

  it('maps an official cancellation to its own stable code', async () => {
    const rig = await makeRig()
    await authorize(rig)
    rig.fake.installResult = { target: PACKAGE_NAME, changed: false, application: 'cancelled' }
    await expect(rig.installer.enable(rig.recipe)).resolves.toMatchObject({
      ok: false,
      errorCode: 'ENT_PRESET_INSTALL_CANCELLED',
      officialApplication: 'cancelled',
    })
  })

  it('uninstalls through the official port, clears the link shell, and never touches the audit log', async () => {
    const rig = await makeRig()
    await authorize(rig)
    await rig.installer.enable(rig.recipe)
    const auditDir = join(rig.profileDir, '.plugin-manager', 'logs', 'operation-fixture')
    await mkdir(auditDir, { recursive: true, mode: 0o700 })
    rig.fake.removeResult = appliedResult(PACKAGE_NAME, 'applied')
    const result = await rig.installer.disable('ent-demo')
    expect(result).toMatchObject({
      ok: true,
      application: 'hot',
      declarationId: 'ent-demo',
      removedNames: [PACKAGE_NAME],
      linkRemoved: true,
    })
    // 官方 remove 只改 package.json/lock，link 残壳由我们清（假端口刻意照官方行为留着）。
    expect(await presetLinkExists(rig.profileDir, PACKAGE_NAME)).toBe(false)
    expect(rig.fake.removeCalls).toEqual([PACKAGE_NAME])
    await expect(readInstalledPresets({ dshHome: rig.dshHome })).resolves.toEqual([])
    expect(await stat(auditDir).then(() => true)).toBe(true)
  })

  it('reports a missing install instead of guessing', async () => {
    const rig = await makeRig()
    await expect(rig.installer.disable('ent-demo')).resolves.toMatchObject({
      ok: false,
      errorCode: 'ENT_RESOURCE_NOT_FOUND',
      removedNames: [],
    })
  })

  it('keeps the record and the link when the official removal fails', async () => {
    const rig = await makeRig()
    await authorize(rig)
    await rig.installer.enable(rig.recipe)
    const boom = new Error('remove exploded')
    rig.fake.removeError = boom
    await expect(rig.installer.disable('ent-demo')).resolves.toMatchObject({
      ok: false,
      errorCode: 'ENT_PRESET_UNINSTALL_FAILED',
    })
    expect(await presetLinkExists(rig.profileDir, PACKAGE_NAME)).toBe(true)
    await expect(readInstalledPresets({ dshHome: rig.dshHome })).resolves.toHaveLength(1)
    expect(rig.errors.at(-1)).toEqual({ message: 'preset bundle removal failed', error: boom })
  })

  it('cleans only the link that points into our bundle root', async () => {
    const dshHome = await makePresetHome()
    const profileDir = join(dshHome, 'profile')
    const nodeModules = join(profileDir, 'node_modules')
    await mkdir(nodeModules, { recursive: true, mode: 0o700 })
    const options = { dshHome, profileDir }

    // ① 缺席：不报错、不创建。
    await expect(cleanPresetBundleLink(options, PACKAGE_NAME)).resolves.toEqual({ removed: false, reason: 'absent' })

    // ② 真实目录：绝不删。
    await mkdir(join(nodeModules, PACKAGE_NAME), { recursive: true, mode: 0o700 })
    await expect(cleanPresetBundleLink(options, PACKAGE_NAME)).resolves.toEqual({ removed: false, reason: 'not-a-symbolic-link' })
    expect(await stat(join(nodeModules, PACKAGE_NAME))).toBeTruthy()
    await rm(join(nodeModules, PACKAGE_NAME), { recursive: true, force: true })

    // ③ 指向我们的 bundle 根之外：绝不删。
    const outsider = join(dshHome, 'outsider')
    await mkdir(outsider, { recursive: true, mode: 0o700 })
    await symlink(outsider, join(nodeModules, PACKAGE_NAME))
    await expect(cleanPresetBundleLink(options, PACKAGE_NAME)).resolves.toEqual({ removed: false, reason: 'foreign-target' })
    expect(await presetLinkExists(profileDir, PACKAGE_NAME)).toBe(true)
    await rm(join(nodeModules, PACKAGE_NAME), { force: true })

    // ④ 指向我们的 bundle 根之内：删掉，且第二次是 absent。
    const mine = join(presetBundleRoot({ dshHome }), 'ent-demo', 'a'.repeat(64))
    await mkdir(mine, { recursive: true, mode: 0o700 })
    await symlink(mine, join(nodeModules, PACKAGE_NAME))
    await expect(cleanPresetBundleLink(options, PACKAGE_NAME)).resolves.toEqual({ removed: true, reason: 'removed' })
    await expect(cleanPresetBundleLink(options, PACKAGE_NAME)).resolves.toEqual({ removed: false, reason: 'absent' })

    // ⑤ 参数门禁：路径分隔符绝不进包名。
    await expect(cleanPresetBundleLink(options, '../escape')).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    await expect(cleanPresetBundleLink(options, 'UPPER')).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
  })
})

describe('official preset install port', () => {
  it('projects a ChangeResult into the controlled application shape', async () => {
    const calls: string[] = []
    const port = officialPresetInstallPort({
      async installBundle(spec) {
        calls.push(spec)
        return {
          target: spec,
          changed: true,
          application: 'restart-required',
          stage: 'enable',
          enabled: true,
          warnings: ['pre-existing inactive entry left as-is', 7],
          failedAt: 'registry',
          error: { code: 'operation-error', diagnostic: 'x'.repeat(4096) },
        }
      },
      async removeBundle(name) {
        calls.push(name)
        return { target: name, changed: true, application: 'applied', stage: 'remove' }
      },
    })
    await expect(port.installBundle('/bundles/ent-demo')).resolves.toEqual({
      target: '/bundles/ent-demo',
      changed: true,
      application: 'restart-required',
      stage: 'enable',
      enabled: true,
      warnings: ['pre-existing inactive entry left as-is'],
      failedAt: 'registry',
      error: { code: 'operation-error' },
    })
    await expect(port.removeBundle(PACKAGE_NAME)).resolves.toMatchObject({ target: PACKAGE_NAME, application: 'applied' })
    expect(calls).toEqual(['/bundles/ent-demo', PACKAGE_NAME])
  })

  it('rethrows the official error unchanged', async () => {
    const boom = new Error('official failure')
    const port = officialPresetInstallPort({
      async installBundle() { throw boom },
      async removeBundle() { throw boom },
    })
    await expect(port.installBundle('/x')).rejects.toBe(boom)
    await expect(port.removeBundle('x')).rejects.toBe(boom)
  })

  it('reads the official service and the profile directory from a host context', () => {
    const manager = { installBundle: async () => ({}), removeBundle: async () => ({}) }
    expect(presetPluginManagerFromContext({ get: name => name === 'pluginManager' ? manager : undefined })).toBe(manager)
    expect(presetPluginManagerFromContext({ get: () => undefined })).toBeUndefined()
    expect(presetPluginManagerFromContext({ get: () => ({ installBundle: () => undefined }) })).toBeUndefined()
    expect(presetProfileDirFromContext({ get: () => ({ dir: '/profiles/web' }) })).toBe('/profiles/web')
    expect(presetProfileDirFromContext({ get: () => undefined })).toBeUndefined()
    // 组合层一行接线：服务在 ⇒ 端口；服务缺席 ⇒ undefined（不猜、不抛）。
    expect(officialPresetInstallPortFromContext({ get: name => name === 'pluginManager' ? manager : undefined }))
      .toBeTypeOf('object')
    expect(officialPresetInstallPortFromContext({ get: () => undefined })).toBeUndefined()
  })
})
