/**
 * [INPUT]: 依赖 node:fs/promises、node:os/node:path（临时 dshHome 落在 `~/.sshwork`，本机硬约束：`/tmp` 不可写）、node:crypto，以及 src/preset 的公开类型
 * [OUTPUT]: 对外提供 `makePresetHome`（临时 dshHome）、`createFakePresetPort`（**假安装端口**：可编排成功/失败/进行中，并按官方行为在装成后留下 link、卸载后**不**清 link）、`SPIKE_RECIPE_YML`/`makeRecipe` 夹具
 * [POS]: tests 下的配方纵测试支撑（**不是产品代码**，`tsconfig.json` 的 `include` 只收 `src/**`，故它只被 vitest 转译、不进 bundle 产物）。用假端口是刻意的：本刀要证的是编排层（幂等/并发/三态/残壳清理），真官方安装面另由 `scripts/preset-e2e.mjs` 在一次性临时 profile 上跑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  PresetApplication,
  PresetBundleApplication,
  PresetInstallPort,
  PresetRecipe,
} from '../src/preset/index.js'

/** spike §1.2 的最低配方正文（根级 entry list，persona 一处）。 */
export const SPIKE_RECIPE_YML = `- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are a helpful software engineer assistant.
    complete: true
    includeRuntimeContext: false
`

/** 覆盖到官方方言的配方正文：`!!js`、`cordis:group` + `isolate`、嵌套 config。 */
export const FULL_RECIPE_YML = `# 夹具：覆盖官方 Loader 方言
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    suffix: Your working directory is {{cwd}}.
    prefix: You are the enterprise onboarding assistant.
- id: agent-instructions
  name: '@deepseek-ai/dsh-agent-instructions'
  config:
    maxBytes: 65536
- id: tool-bash
  name: '@deepseek-ai/dsh-tool-bash'
  disabled: !!js process.platform === 'win32'
- id: planning
  name: cordis:group
  group: true
  isolate:
    planMode: true
  config:
    - id: plan-mode
      name: '@deepseek-ai/dsh-plan-mode'
`

/** 造一份配方；缺省用 spike 夹具。 */
export function makeRecipe(overrides: Partial<PresetRecipe['manifest']> = {}, body: string = SPIKE_RECIPE_YML): PresetRecipe {
  return {
    manifest: {
      id: 'ent-demo',
      name: '企业配方演示',
      description: '演示用的企业配方。',
      order: 60,
      ...overrides,
    },
    agentCordisYml: body,
  }
}

/** 本进程创建过的临时 dshHome；`cleanupPresetHomes` 在 afterEach 里统一删（与 skill-install.spec 同一套纪律）。 */
const createdHomes: string[] = []

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
export async function makePresetHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const path = await mkdtemp(join(root, 'dshent-preset-'))
  createdHomes.push(path)
  return path
}

/** 删掉本 spec 文件创建的全部临时 dshHome；spec 里 `afterEach(cleanupPresetHomes)` 即可。 */
export async function cleanupPresetHomes(): Promise<void> {
  await Promise.all(createdHomes.splice(0).map(path => rm(path, { force: true, recursive: true })))
}

/** 与官方 `ChangeResult` 同形的成功结果。 */
export function appliedResult(target: string, application: PresetApplication = 'applied'): PresetBundleApplication {
  return { target, changed: true, application, stage: 'enable', enabled: true, warnings: [] }
}

export interface FakePresetPort {
  readonly port: PresetInstallPort
  readonly installCalls: string[]
  readonly removeCalls: string[]
  installResult: PresetBundleApplication
  removeResult: PresetBundleApplication
  installError: unknown
  removeError: unknown
  /** 若设，`installBundle` 先等它 resolve 再返回（用于「进行中」用例）。 */
  installGate?: Promise<void>
  /** 若设，装成后按官方行为在 `<profileDir>/node_modules` 留一枚 link（卸载**不**清，正好让清理段去清）。 */
  linkOnInstall: boolean
  readonly linkPath?: (packageName: string) => string
  profileDir?: string
}

/**
 * 假安装端口。默认行为对齐官方实测（spike §3⑤）：装成后 `node_modules/<pkg>` 出现 link；卸载成功后 link **仍在**。
 */
export function createFakePresetPort(options: {
  readonly profileDir?: string
  readonly installResult?: PresetBundleApplication
  readonly removeResult?: PresetBundleApplication
  readonly linkOnInstall?: boolean
} = {}): FakePresetPort {
  const state = {
    installCalls: [] as string[],
    removeCalls: [] as string[],
    installResult: options.installResult ?? appliedResult('dsh-ent-preset-ent-demo'),
    removeResult: options.removeResult ?? appliedResult('dsh-ent-preset-ent-demo', 'applied'),
    installError: undefined as unknown,
    removeError: undefined as unknown,
    installGate: undefined as Promise<void> | undefined,
    linkOnInstall: options.linkOnInstall ?? true,
    profileDir: options.profileDir,
    port: undefined as unknown as PresetInstallPort,
  }
  state.port = {
    async installBundle(spec) {
      state.installCalls.push(spec)
      if (state.installGate !== undefined) await state.installGate
      if (state.installError !== undefined) throw state.installError
      if (state.linkOnInstall && state.profileDir !== undefined) {
        const manifest = JSON.parse(await readFile(join(spec, 'package.json'), 'utf8')) as { name: string }
        await mkdir(join(state.profileDir, 'node_modules'), { recursive: true, mode: 0o700 })
        await symlink(spec, join(state.profileDir, 'node_modules', manifest.name)).catch(() => undefined)
      }
      return state.installResult
    },
    async removeBundle(name) {
      state.removeCalls.push(name)
      if (state.removeError !== undefined) throw state.removeError
      return state.removeResult
    },
  }
  return state
}
