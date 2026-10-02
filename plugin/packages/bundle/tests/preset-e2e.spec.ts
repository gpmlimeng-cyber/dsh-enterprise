/**
 * [INPUT]: 依赖 node:child_process/fs/path/os、vitest，src/preset 的合成/授权/安装三段，以及本机官方 `dsh` CLI
 * [OUTPUT]: 在**一次性临时 profile** 上跑真安装的端到端门禁：基线 roster → 合成 → 走官方唯一安装面装进临时 profile → roster +1 且出现 `preset-<id>` → 卸载 → roster 回基线 → 删临时 profile 并给出未残留证据；web profile 全程零写入
 * [POS]: 配方纵深的**真安装**门禁（默认跳过，只在 `DSH_PRESET_E2E=1` 时运行，避免把「本机装了官方 dsh 且有网络/存储」带进日常门禁）。跑法见 `docs/notes/preset-bundle-spike.md` 的记录方式：只用一次性临时 profile，绝不碰用户正在用的 web profile
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authorizePreset,
  createEnterprisePresetInstall,
  presetBundleSetFingerprint,
  presetLinkExists,
  readInstalledPresets,
  renderPresetBundle,
  synthesizePresetBundle,
  type PresetBundleApplication,
  type PresetInstallPort,
  type PresetRecipe,
} from '../src/preset/index.js'

const ENABLED = process.env['DSH_PRESET_E2E'] === '1'
const HOME_DIR = homedir()
const DSH_HOME_DIR = join(HOME_DIR, '.dsh')
const PROFILES_DIR = join(DSH_HOME_DIR, 'profiles')
const WORK_DIR = join(HOME_DIR, '.sshwork')
const PROFILE_NAME = `ent-preset-e2e-${process.pid}`
const PROFILE_DIR = join(PROFILES_DIR, PROFILE_NAME)
const WEB_DIR = join(PROFILES_DIR, 'web')
const DECLARATION_ID = 'ent-e2e'
const ROW_ID = `preset-${DECLARATION_ID}`
const PACKAGE_NAME = `dsh-ent-preset-${DECLARATION_ID}`

const RECIPE: PresetRecipe = {
  manifest: {
    id: DECLARATION_ID,
    name: '企业配方端到端',
    description: '在一次性临时 profile 上验证「合成 → 官方安装 → roster +1 → 卸载 → 回基线」。',
    order: 90,
  },
  agentCordisYml: `- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are the enterprise end-to-end preset.
    complete: true
    includeRuntimeContext: false
`,
}

interface CommandResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

function runDsh(args: readonly string[], timeoutMs = 300_000): CommandResult {
  const result = spawnSync('dsh', [...args], { encoding: 'utf8', timeout: timeoutMs })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function dumpConfig(profile: string): CommandResult {
  return runDsh(['--profile', profile, '--dump-config'])
}

function presetRowCount(dump: string): number {
  return (dump.match(/^- id: preset-/gm) ?? []).length
}

function withoutComments(dump: string): string {
  return dump.split('\n').filter(line => !line.startsWith('#')).join('\n')
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function entryNames(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

/** 一次性临时 profile：包清单只声明 base + web-app（后者的 patch 才带来官方 preset registry）。 */
function createTempProfile(): void {
  rmSync(PROFILE_DIR, { force: true, recursive: true })
  mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(join(PROFILE_DIR, 'package.json'), `${JSON.stringify({
    name: 'dsh-profile-ent-preset-e2e',
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'], patchReload: 'startup' } },
  }, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(join(PROFILE_DIR, 'pnpm-workspace.yaml'), 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n', { mode: 0o600 })
}

/**
 * CLI 面端口：与官方 Host 服务面**同一个 `runProfilePnpm` 引擎**（spike §4），只是没有流式进度与结构化
 * `application`。故这里把退出码 0 投影成 `applied`，退出码非 0 原样带回 stderr 作为 diagnostic。
 */
function createCliPresetPort(): PresetInstallPort {
  const add = (spec: string): PresetBundleApplication => {
    const result = runDsh(['plugin', '--profile', PROFILE_NAME, 'add', spec])
    if (result.status === 0) {
      return { target: spec, changed: true, application: 'applied', stage: 'enable', enabled: true, warnings: [] }
    }
    return { target: spec, changed: false, application: 'failed', error: { code: 'operation-error', diagnostic: result.stderr.trim().slice(0, 200) } }
  }
  const remove = (name: string): PresetBundleApplication => {
    const result = runDsh(['plugin', '--profile', PROFILE_NAME, 'remove', name])
    if (result.status === 0) {
      return { target: name, changed: true, application: 'applied', stage: 'remove' }
    }
    return { target: name, changed: false, application: 'failed', error: { code: 'operation-error', diagnostic: result.stderr.trim().slice(0, 200) } }
  }
  return {
    installBundle: async spec => add(spec),
    removeBundle: async name => remove(name),
  }
}

describe.skipIf(!ENABLED)('preset real install e2e (one-off temporary profile)', () => {
  it('synthesizes, installs into a throwaway profile, shows the preset row, uninstalls, and leaves no residue', async () => {
    mkdirSync(WORK_DIR, { recursive: true, mode: 0o700 })
    const dshHome = join(WORK_DIR, `preset-e2e-home-${process.pid}`)
    const evidencePath = join(WORK_DIR, `preset-e2e-evidence-${process.pid}.json`)
    const profileListingBefore = entryNames(PROFILES_DIR)
    const webHashesBefore = {
      packageJson: sha256(join(WEB_DIR, 'package.json')),
      patch: sha256(join(WEB_DIR, 'cordis.patch.yml')),
      lock: sha256(join(WEB_DIR, 'pnpm-lock.yaml')),
    }
    const webNodeModulesCountBefore = entryNames(join(WEB_DIR, 'node_modules')).length
    const webLogsCountBefore = entryNames(join(WEB_DIR, '.plugin-manager', 'logs')).length
    const webLinkBefore = existsSync(join(WEB_DIR, 'node_modules', PACKAGE_NAME))
    const evidence: Record<string, unknown> = {
      profileName: PROFILE_NAME,
      declarationId: DECLARATION_ID,
      rowId: ROW_ID,
      packageName: PACKAGE_NAME,
      profileListingBefore,
      webHashesBefore,
      webNodeModulesCountBefore,
      webLogsCountBefore,
    }
    try {
      createTempProfile()
      const baselineDump = dumpConfig(PROFILE_NAME)
      expect(baselineDump.status).toBe(0)
      const baselineRoster = presetRowCount(baselineDump.stdout)
      expect(baselineRoster).toBe(4)
      expect(baselineDump.stdout).not.toContain(ROW_ID)

      // ① 合成（纯函数 + 落盘）
      const rendered = renderPresetBundle(RECIPE)
      const synthesized = await synthesizePresetBundle({ dshHome }, RECIPE)
      expect(readdirSync(synthesized.bundleDir).sort()).toEqual(['cordis.patch.yml', 'package.json'])

      // ② 授权门（集合指纹一次授权）
      const fingerprint = presetBundleSetFingerprint(rendered.bundleSet)
      await authorizePreset({ dshHome }, rendered.declarationId, fingerprint)

      // ③ 走官方唯一安装面装进临时 profile
      const installer = createEnterprisePresetInstall({
        dshHome,
        profileDir: PROFILE_DIR,
        port: createCliPresetPort(),
        onError: (message, error) => { evidence[`onError:${message}`] = String(error) },
      })
      const enabled = await installer.enable(RECIPE)
      expect(enabled.ok).toBe(true)
      expect(enabled.installedNames).toEqual([PACKAGE_NAME])
      expect(enabled.needsNewSession).toBe(true)

      const afterInstallDump = dumpConfig(PROFILE_NAME)
      expect(afterInstallDump.status).toBe(0)
      expect(presetRowCount(afterInstallDump.stdout)).toBe(baselineRoster + 1)
      expect(afterInstallDump.stdout).toContain(ROW_ID)
      expect(afterInstallDump.stdout).toContain(`id: ${DECLARATION_ID}`)
      expect(await presetLinkExists(PROFILE_DIR, PACKAGE_NAME)).toBe(true)
      expect(await readInstalledPresets({ dshHome })).toHaveLength(1)

      // ④ 卸载 + link 残壳清理
      const disabled = await installer.disable(DECLARATION_ID)
      expect(disabled).toMatchObject({ ok: true, removedNames: [PACKAGE_NAME], linkRemoved: true })
      expect(await presetLinkExists(PROFILE_DIR, PACKAGE_NAME)).toBe(false)
      expect(await readInstalledPresets({ dshHome })).toEqual([])

      const afterRemoveDump = dumpConfig(PROFILE_NAME)
      expect(afterRemoveDump.status).toBe(0)
      expect(presetRowCount(afterRemoveDump.stdout)).toBe(baselineRoster)
      expect(afterRemoveDump.stdout).not.toContain(ROW_ID)
      // roster/composition 逐行回到基线（只比对非注释行：注释行带临时 profile 的绝对路径）。
      expect(withoutComments(afterRemoveDump.stdout)).toBe(withoutComments(baselineDump.stdout))
      // 官方审计日志目录仍在（我们绝不删）。
      expect(entryNames(join(PROFILE_DIR, '.plugin-manager', 'logs')).length).toBeGreaterThan(0)

      evidence['baselineRoster'] = baselineRoster
      evidence['installedRoster'] = presetRowCount(afterInstallDump.stdout)
      evidence['restoredRoster'] = presetRowCount(afterRemoveDump.stdout)
      evidence['bundleDir'] = synthesized.bundleDir
      evidence['digest'] = rendered.digest
      evidence['fingerprint'] = fingerprint
      evidence['rosterBackToBaseline'] = true
    } finally {
      // ⑤ 删临时 profile，并给出未残留证据
      rmSync(PROFILE_DIR, { force: true, recursive: true })
      rmSync(dshHome, { force: true, recursive: true })
      const profileListingAfter = entryNames(PROFILES_DIR)
      evidence['profileListingAfter'] = profileListingAfter
      evidence['tempProfileRemoved'] = !existsSync(PROFILE_DIR)
      evidence['profileListingRestored'] = JSON.stringify(profileListingAfter) === JSON.stringify(profileListingBefore)
      evidence['webHashesAfter'] = {
        packageJson: sha256(join(WEB_DIR, 'package.json')),
        patch: sha256(join(WEB_DIR, 'cordis.patch.yml')),
        lock: sha256(join(WEB_DIR, 'pnpm-lock.yaml')),
      }
      evidence['webUntouched'] = JSON.stringify(evidence['webHashesAfter']) === JSON.stringify(webHashesBefore)
      evidence['webNodeModulesCountAfter'] = entryNames(join(WEB_DIR, 'node_modules')).length
      evidence['webLogsCountAfter'] = entryNames(join(WEB_DIR, '.plugin-manager', 'logs')).length
      evidence['webLinkBefore'] = webLinkBefore
      evidence['webLinkAfter'] = existsSync(join(WEB_DIR, 'node_modules', PACKAGE_NAME))
      writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
      console.log(`[preset-e2e] evidence: ${evidencePath}`)
      console.log(JSON.stringify(evidence, null, 2))

      expect(evidence['tempProfileRemoved']).toBe(true)
      expect(evidence['profileListingRestored']).toBe(true)
      expect(evidence['webUntouched']).toBe(true)
      expect(evidence['webNodeModulesCountAfter']).toBe(webNodeModulesCountBefore)
      expect(evidence['webLogsCountAfter']).toBe(webLogsCountBefore)
      expect(evidence['webLinkAfter']).toBe(false)
    }
  }, 900_000)
})
