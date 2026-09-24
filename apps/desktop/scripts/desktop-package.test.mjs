import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  activateOverlay,
  applyBrand,
  buildPlan,
  loadBrand,
  loadPlugins,
  officialScript,
  renderOverlay,
  restoreOverlay,
  signingGaps,
  stagePlugins,
  validateBrand,
} from './desktop-package.mjs'

const brand = {
  productName: 'DSH Enterprise',
  appId: 'com.dshent.desktop',
  artifactPrefix: 'dsh-enterprise',
  urlSchemes: ['dsh'],
}

test('brand rejects DeepSeek product identity', () => {
  assert.throws(() => validateBrand({ ...brand, productName: 'DeepSeek Enterprise' }), /DeepSeek/)
  assert.throws(() => validateBrand({ ...brand, appId: 'com.deepseek.desktop' }), /com\.deepseek/)
})

test('brand overlay renames the package and appends bundled plugins', () => {
  const upstream = {
    productName: 'DeepSeek Harness',
    appId: 'com.deepseek.harness',
    extraResources: [{ from: 'runtime', to: 'runtime' }],
    mac: { icon: 'upstream.png', notarize: true },
  }
  const branded = applyBrand(upstream, brand, { bundledPluginsDir: '/tmp/bundled-plugins' })
  assert.equal(upstream.extraResources.length, 1)
  assert.equal(branded.productName, 'DSH Enterprise')
  assert.equal(branded.appId, 'com.dshent.desktop')
  assert.equal(branded.artifactName, 'dsh-enterprise-${version}-${os}-${arch}.${ext}')
  assert.equal(branded.extraResources[0].to, 'runtime')
  assert.equal(branded.extraResources[1].to, 'dshent/bundled-plugins')
  assert.equal(branded.mac.notarize, true)
})

test('checked-in brand and plugin manifest match the workspace package', () => {
  assert.equal(loadBrand().appId, 'com.dshent.desktop')
  const plugins = loadPlugins()
  assert.equal(plugins.packages[0].packageName, 'dshent-plugin')
  assert.equal(plugins.installArgs.includes('--ignore-scripts'), true)
})

test('plan uses the official desktop lock and official package script', () => {
  const plan = buildPlan({ target: 'mac-arm64', env: {} })
  assert.equal(plan.upstream.commit, '46a7f68b0922371ce7144b668b90e377d8e799f4')
  assert.equal(plan.upstream.version, '0.1.7-rc.1')
  assert.equal(plan.upstream.path, 'apps/desktop')
  assert.deepEqual(plan.command.slice(-2), ['run', 'package:mac:arm64'])
  assert.equal(plan.signingGaps.includes('DSH_DESKTOP_MACOS_SIGNING_IDENTITY'), true)
  assert.equal(officialScript('win-x64', { unsigned: true }), 'package:win:x64:unsigned')
  assert.equal(signingGaps('win-x64', {}, { unsigned: true }).length, 0)
})

test('overlay replaces and restores the upstream config', () => {
  const root = mkdtempSync(join(tmpdir(), 'dshent-desktop-'))
  try {
    const appRoot = join(root, 'app')
    const upstream = join(root, 'upstream', 'apps', 'desktop')
    mkdirSync(join(appRoot, '.build'), { recursive: true })
    mkdirSync(upstream, { recursive: true })
    const config = join(upstream, 'electron-builder.config.mjs')
    writeFileSync(config, 'export default { productName: "DeepSeek Harness" }\n')
    activateOverlay(appRoot, config)
    assert.match(readFileSync(config, 'utf8'), /applyBrand/)
    assert.equal(restoreOverlay(appRoot), true)
    assert.equal(readFileSync(config, 'utf8'), 'export default { productName: "DeepSeek Harness" }\n')
    assert.equal(restoreOverlay(appRoot), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('generated overlay does not embed a product name', () => {
  assert.doesNotMatch(renderOverlay(), /DSH Enterprise|DeepSeek Harness/)
})

test('stagePlugins records the tarball reported by pnpm pack', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dshent-plugins-'))
  try {
    const destination = join(root, 'bundled')
    const tarball = join(destination, 'dshent-plugin-0.1.0.tgz')
    const plugins = {
      profile: 'desktop',
      installArgs: ['--ignore-scripts', '--save-exact'],
      packages: [{ packageName: 'dshent-plugin', workspace: 'plugin/packages/bundle', source: 'workspace' }],
    }
    const staged = await stagePlugins({
      destination,
      plugins,
      projectRoot: root,
      run: async () => {
        mkdirSync(destination, { recursive: true })
        writeFileSync(tarball, 'not a real package')
        return 'dshent-plugin-0.1.0.tgz\n'
      },
    })
    assert.equal(staged.manifest.packages[0].file, 'dshent-plugin-0.1.0.tgz')
    assert.equal(JSON.parse(readFileSync(join(destination, 'manifest.json'), 'utf8')).profile, 'desktop')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
