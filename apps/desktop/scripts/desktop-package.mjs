/**
 * [INPUT]: 依赖 brand.json、plugins.json、upstream/deepseek-harness-desktop.lock.json、同级官方 checkout
 * [OUTPUT]: 打印打包计划，暂存内置插件，或临时覆盖上游配置后调用官方 package 脚本
 * [POS]: 企业桌面安装包入口；不复制上游源码
 * [PROTOCOL]: 变更时更新此头部，然后检查 ../CLAUDE.md
 */

import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadBaselineLocks } from '../../../scripts/upstream-baseline.mjs'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ROOT = resolve(APP_ROOT, '../..')
const TARGETS = {
  'mac-arm64': { platform: 'darwin', script: 'package:mac:arm64', directoryScript: 'package:mac:arm64:dir' },
  'mac-x64': { platform: 'darwin', script: 'package:mac:x64', directoryScript: 'package:mac:x64:dir' },
  'win-x64': { platform: 'win32', script: 'package:win:x64', directoryScript: 'package:win:x64:dir', unsignedScript: 'package:win:x64:unsigned' },
}

function fail(message) {
  throw new Error(message)
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`desktop package: cannot read ${label}: ${error.message}`)
  }
}

function inside(root, path) {
  const resolved = resolve(root, path)
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (resolved !== root && !resolved.startsWith(prefix)) fail(`desktop package: path escapes ${root}: ${path}`)
  return resolved
}

export function loadBrand(appRoot = APP_ROOT) {
  const brand = readJson(join(appRoot, 'brand.json'), 'brand.json')
  validateBrand(brand, appRoot)
  return brand
}

export function validateBrand(brand, appRoot = APP_ROOT) {
  if (!brand || typeof brand !== 'object') fail('desktop package: brand must be an object')
  if (typeof brand.productName !== 'string' || brand.productName.trim() === '' || brand.productName.length > 40) {
    fail('desktop package: productName must be 1-40 characters')
  }
  if (/deepseek/i.test(brand.productName) || brand.productName === 'DeepSeek Harness') {
    fail('desktop package: productName must not use the DeepSeek name')
  }
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u.test(brand.appId ?? '')) {
    fail('desktop package: appId must be a reverse-DNS identifier')
  }
  if (/^com\.deepseek\./i.test(brand.appId)) fail('desktop package: appId must not use com.deepseek')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(brand.artifactPrefix ?? '')) {
    fail('desktop package: artifactPrefix must be a lowercase filename prefix')
  }
  if (brand.urlSchemes !== undefined) {
    if (!Array.isArray(brand.urlSchemes) || brand.urlSchemes.some(scheme => !/^[a-z][a-z0-9+.-]{0,30}$/u.test(scheme))) {
      fail('desktop package: urlSchemes must be lowercase scheme names')
    }
  }
  for (const [key, value] of Object.entries(brand.icons ?? {})) {
    if (!['mac', 'windows'].includes(key) || typeof value !== 'string' || value.startsWith('/') || value.includes('..')) {
      fail(`desktop package: icons.${key} must be a relative path under the desktop app`)
    }
    const icon = inside(appRoot, value)
    if (!existsSync(icon)) fail(`desktop package: missing icon ${value}`)
  }
  return brand
}

export function loadPlugins(projectRoot = PROJECT_ROOT, appRoot = APP_ROOT) {
  const plugins = readJson(join(appRoot, 'plugins.json'), 'plugins.json')
  validatePlugins(plugins, projectRoot)
  return plugins
}

export function validatePlugins(plugins, projectRoot = PROJECT_ROOT) {
  if (!plugins || typeof plugins !== 'object') fail('desktop package: plugins must be an object')
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/u.test(plugins.profile ?? '')) fail('desktop package: plugin profile is invalid')
  if (!Array.isArray(plugins.installArgs) || plugins.installArgs.some(arg => typeof arg !== 'string' || arg.startsWith('-') === false)) {
    fail('desktop package: installArgs must be an array of flags')
  }
  if (!Array.isArray(plugins.packages) || plugins.packages.length === 0) fail('desktop package: at least one built-in plugin is required')
  for (const item of plugins.packages) {
    if (item?.source !== 'workspace') fail('desktop package: built-in plugins must come from the workspace')
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/u.test(item.packageName ?? '')) fail('desktop package: plugin packageName is invalid')
    const workspace = inside(projectRoot, item.workspace ?? '')
    const manifest = readJson(join(workspace, 'package.json'), `${item.workspace}/package.json`)
    if (manifest.name !== item.packageName) {
      fail(`desktop package: ${item.workspace} is ${manifest.name}, not ${item.packageName}`)
    }
  }
  return plugins
}

export function applyBrand(config, brand, options = {}) {
  validateBrand(brand)
  const resources = [...(config.extraResources ?? [])]
  if (options.bundledPluginsDir) {
    resources.push({ from: options.bundledPluginsDir, to: 'dshent/bundled-plugins' })
  }
  return {
    ...config,
    appId: brand.appId,
    productName: brand.productName,
    artifactName: `${brand.artifactPrefix}-\${version}-\${os}-\${arch}.\${ext}`,
    extraMetadata: {
      ...config.extraMetadata,
      dshDesktopAppId: brand.appId,
      dshentProductName: brand.productName,
    },
    protocols: [{ name: brand.productName, schemes: brand.urlSchemes ?? ['dsh'] }],
    extraResources: resources,
    mac: config.mac && brand.icons?.mac ? { ...config.mac, icon: resolve(APP_ROOT, brand.icons.mac) } : config.mac,
    win: config.win && brand.icons?.windows ? { ...config.win, icon: resolve(APP_ROOT, brand.icons.windows) } : config.win,
  }
}

export function renderOverlay() {
  const moduleUrl = pathToFileURL(fileURLToPath(import.meta.url)).href
  return `/** Generated packaging overlay. Restored after the upstream package command. */\nimport { createElectronBuilderConfig } from './scripts/electron-builder-config.mjs'\nimport { applyBrand, loadBrand } from ${JSON.stringify(moduleUrl)}\n\nconst config = createElectronBuilderConfig()\nexport default applyBrand(config, loadBrand(), {\n  bundledPluginsDir: process.env.DSHENT_BUNDLED_PLUGINS_DIR,\n})\nexport { createElectronBuilderConfig }\n`
}

export function signingGaps(target, env = process.env, { unsigned = false } = {}) {
  const selected = TARGETS[target]
  if (selected === undefined) return [`unsupported target ${target}`]
  if (selected.platform === 'win32' && unsigned) return []
  if (selected.platform === 'darwin') {
    const gaps = []
    if (!env.DSH_DESKTOP_MACOS_SIGNING_IDENTITY?.trim()) gaps.push('DSH_DESKTOP_MACOS_SIGNING_IDENTITY')
    if (!/^[A-Z0-9]{10}$/u.test(env.DSH_DESKTOP_MACOS_TEAM_ID?.trim() ?? '')) gaps.push('DSH_DESKTOP_MACOS_TEAM_ID')
    const notarized = Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER)
      || Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
      || Boolean(env.APPLE_KEYCHAIN_PROFILE?.trim())
    if (!notarized) gaps.push('Apple notarization credentials')
    return gaps
  }
  return env.DSH_DESKTOP_WINDOWS_CER_FILE?.trim() ? [] : ['DSH_DESKTOP_WINDOWS_CER_FILE']
}

export function officialScript(target, { directory = false, unsigned = false } = {}) {
  const selected = TARGETS[target]
  if (selected === undefined) fail(`desktop package: unsupported target ${target}`)
  if (unsigned && selected.unsignedScript === undefined) fail('desktop package: unsigned builds are only supported for win-x64')
  if (unsigned) return selected.unsignedScript
  return directory ? selected.directoryScript : selected.script
}

export function defaultTarget(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin' && arch === 'arm64') return 'mac-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'mac-x64'
  if (platform === 'win32' && arch === 'x64') return 'win-x64'
  fail(`desktop package: unsupported host ${platform}-${arch}; pass --target`)
}

function checkoutRoot(explicit) {
  return resolve(explicit ?? join(PROJECT_ROOT, '..', 'dsh-desktop'))
}

function upstreamDesktop(checkout) {
  return join(checkout, 'apps', 'desktop')
}

export function buildPlan(options = {}) {
  const locks = loadBaselineLocks(options.projectRoot ?? PROJECT_ROOT)
  const brand = options.brand ?? loadBrand(options.appRoot ?? APP_ROOT)
  const plugins = options.plugins ?? loadPlugins(options.projectRoot ?? PROJECT_ROOT, options.appRoot ?? APP_ROOT)
  const checkout = checkoutRoot(options.checkout)
  const target = options.target ?? defaultTarget()
  const directory = options.directory === true
  const unsigned = options.unsigned === true
  const script = officialScript(target, { directory, unsigned })
  const desktop = upstreamDesktop(checkout)
  const present = existsSync(join(desktop, 'package.json'))
  return {
    brand,
    plugins: plugins.packages.map(item => item.packageName),
    upstream: {
      repository: locks.client.repository,
      version: locks.client.version,
      commit: locks.client.commit,
      path: locks.client.desktop.path,
      checkout,
      present,
    },
    command: ['pnpm', '--dir', desktop, 'run', script],
    signingGaps: signingGaps(target, options.env ?? process.env, { unsigned }),
    bundledPlugins: join(options.appRoot ?? APP_ROOT, '.build', 'bundled-plugins'),
    notes: [
      'Upstream source stays outside this repository.',
      'Built-in plugin tarballs are package resources; upstream does not install them on first launch.',
    ],
  }
}

function overlayStatePath(appRoot = APP_ROOT) {
  return join(appRoot, '.build', 'overlay.json')
}

export function activateOverlay(appRoot, upstreamConfig) {
  const statePath = overlayStatePath(appRoot)
  if (existsSync(statePath)) fail('desktop package: overlay already active; run restore')
  if (!existsSync(upstreamConfig)) fail(`desktop package: missing upstream config ${upstreamConfig}`)
  const backup = join(appRoot, '.build', 'electron-builder.config.mjs.upstream')
  mkdirSync(dirname(backup), { recursive: true })
  copyFileSync(upstreamConfig, backup)
  writeFileSync(statePath, `${JSON.stringify({ target: upstreamConfig, backup }, null, 2)}\n`)
  writeFileSync(upstreamConfig, renderOverlay())
  return { target: upstreamConfig, backup }
}

export function restoreOverlay(appRoot = APP_ROOT) {
  const statePath = overlayStatePath(appRoot)
  if (!existsSync(statePath)) return false
  const state = readJson(statePath, 'overlay.json')
  if (!existsSync(state.backup)) fail(`desktop package: missing overlay backup ${state.backup}`)
  copyFileSync(state.backup, state.target)
  rmSync(state.backup, { force: true })
  rmSync(statePath, { force: true })
  return true
}

function assertCleanCheckout(checkout, commit) {
  if (!existsSync(join(checkout, '.git'))) fail(`desktop package: upstream checkout not found: ${checkout}`)
  const head = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (head !== commit) fail(`desktop package: checkout ${head} is not locked commit ${commit}`)
  const status = execFileSync('git', ['-C', checkout, 'status', '--porcelain'], { encoding: 'utf8' })
  if (status.trim() !== '') fail('desktop package: upstream checkout is dirty; packaging will not overlay it')
}

function runCommand(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`desktop package: ${command} exited ${code}`))
    })
  })
}

export async function stagePlugins(options = {}) {
  const projectRoot = options.projectRoot ?? PROJECT_ROOT
  const appRoot = options.appRoot ?? APP_ROOT
  const plugins = options.plugins ?? loadPlugins(projectRoot, appRoot)
  const destination = options.destination ?? join(appRoot, '.build', 'bundled-plugins')
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(destination)) {
    if (entry.endsWith('.tgz') || entry === 'manifest.json') rmSync(join(destination, entry))
  }
  const staged = []
  for (const item of plugins.packages) {
    const workspace = inside(projectRoot, item.workspace)
    const args = ['--dir', workspace, 'pack', '--pack-destination', destination]
    if (!options.run) execFileSync('pnpm', ['--dir', workspace, 'run', 'build'], { stdio: 'inherit' })
    const stdout = options.run
      ? await options.run('pnpm', args)
      : execFileSync('pnpm', args, { encoding: 'utf8' })
    const filename = String(stdout).match(/[^\s'"]+\.tgz/g)?.at(-1)
    if (!filename || !filename.endsWith('.tgz')) fail(`desktop package: pnpm pack did not report a tarball for ${item.packageName}`)
    const packed = filename.includes(sep) || filename.includes('/') ? filename : join(destination, filename)
    if (!existsSync(packed)) fail(`desktop package: packed tarball not found: ${packed}`)
    const storedName = basename(packed)
    if (storedName.includes('..')) fail(`desktop package: invalid tarball name ${storedName}`)
    const stored = join(destination, storedName)
    if (resolve(packed) !== resolve(stored)) copyFileSync(packed, stored)
    staged.push({ packageName: item.packageName, file: storedName })
  }
  const manifest = {
    schemaVersion: 1,
    profile: plugins.profile,
    installArgs: plugins.installArgs,
    packages: staged,
  }
  writeFileSync(join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { destination, manifest }
}

export function installPluginCommand(checkout, tarball, profile, installArgs) {
  return ['pnpm', '--dir', checkout, 'dsh', 'plugin', '--profile', profile, 'add', ...installArgs, tarball]
}

async function packageDesktop(options) {
  const plan = buildPlan(options)
  if (!plan.upstream.present) fail(`desktop package: prepare the official checkout first: ${plan.upstream.checkout}`)
  if (plan.signingGaps.length > 0) {
    fail(`desktop package: missing ${plan.signingGaps.join(', ')}`)
  }
  assertCleanCheckout(plan.upstream.checkout, plan.upstream.commit)
  const staged = await stagePlugins(options)
  const upstreamConfig = join(upstreamDesktop(plan.upstream.checkout), 'electron-builder.config.mjs')
  activateOverlay(options.appRoot ?? APP_ROOT, upstreamConfig)
  try {
    await runCommand(plan.command[0], plan.command.slice(1), {
      ...process.env,
      DSH_DESKTOP_APP_ID: plan.brand.appId,
      DSHENT_BUNDLED_PLUGINS_DIR: staged.destination,
    })
  } finally {
    restoreOverlay(options.appRoot ?? APP_ROOT)
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = { command, directory: false, unsigned: false }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--dir') options.directory = true
    else if (arg === '--unsigned') options.unsigned = true
    else if (arg === '--target') options.target = rest[++index]
    else if (arg === '--checkout') options.checkout = rest[++index]
    else fail(`desktop package: unknown argument ${arg}`)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.command === 'plan') {
    console.log(JSON.stringify(buildPlan(options), null, 2))
    return
  }
  if (options.command === 'stage-plugins') {
    const staged = await stagePlugins(options)
    console.log(staged.destination)
    return
  }
  if (options.command === 'restore') {
    console.log(restoreOverlay() ? 'restored' : 'no active overlay')
    return
  }
  if (options.command === 'install-plugins') {
    const plan = buildPlan(options)
    const manifestPath = join(plan.bundledPlugins, 'manifest.json')
    const manifest = readJson(manifestPath, 'bundled plugin manifest')
    for (const item of manifest.packages) {
      if (typeof item.file !== 'string' || item.file.includes('..') || item.file.includes('/') || item.file.includes('\\')) {
        fail(`desktop package: bundled plugin path is not a file name: ${item.file}`)
      }
      const tarball = join(plan.bundledPlugins, item.file)
      const command = installPluginCommand(plan.upstream.checkout, tarball, manifest.profile, manifest.installArgs)
      await runCommand(command[0], command.slice(1), process.env)
    }
    return
  }
  if (options.command === 'package') {
    await packageDesktop(options)
    return
  }
  fail('desktop package: use plan, stage-plugins, package, install-plugins, or restore')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
