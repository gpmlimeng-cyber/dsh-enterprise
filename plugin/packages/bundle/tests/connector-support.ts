/**
 * [INPUT]: 依赖 node:fs/promises / node:os / node:path 与 `../src/connector/index.js` 的入口
 * [OUTPUT]: 对外提供 `declarationFixture`（可覆写的能力声明夹具）、`readDeclarationFixture`（已规范化的声明）、`connectorDescriptorFixture`（可覆写的连接器夹具）与 `makeConnectorHome`/`cleanupConnectorHomes`（临时 dshHome）
 * [POS]: tests 下的连接器纵测试支撑（**不是产品代码**：`tsconfig.json` 的 `include` 只收 `src/**`，故它只被 vitest 转译、不进 bundle 产物）；dshHome 按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`（与 `preset-support.ts` / `skill-install.spec.ts` 同一套纪律）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  connectorBundlePackageName,
  connectorLinkPath,
  readConnectorCapabilityDeclaration,
  type ConnectorBundleApplication,
  type ConnectorCapabilityDeclaration,
  type ConnectorInstallPort,
  type McpConnectorDescriptor,
} from '../src/connector/index.js'

/** 一条**合法**的声明（`readConnectorCapabilityDeclaration` 必定接受）；测试用覆写把它推离合法域。 */
export function declarationFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    capabilityId: 'ent-demo-read',
    title: '示例只读能力',
    summary: '读一份企业内部文档。',
    stateAddress: { kind: 'resource', path: 'documents/readme' },
    effects: ['read'],
    reversibility: 'reversible',
    blastRadius: 'self',
    transport: 'mcp',
    authRef: 'ENT_DEMO_TOKEN',
    egressAllowlist: ['api.example.com'],
    quota: { maxCalls: 100, windowSeconds: 3600 },
    inbound: 'none',
    auditEvents: ['CONNECTOR_CALL'],
    platformRequired: [
      { platform: 'android', support: 'supported' },
      { platform: 'linux', support: 'supported' },
    ],
    discovery: ['catalog'],
    ...overrides,
  }
}

/** 夹具 → 规范化声明。 */
export function readDeclarationFixture(overrides: Record<string, unknown> = {}): ConnectorCapabilityDeclaration {
  return readConnectorCapabilityDeclaration(declarationFixture(overrides))
}

/** 一条**合法**的连接器（stdio），默认带一枚凭据引用。 */
export function connectorDescriptorFixture(overrides: Partial<McpConnectorDescriptor> = {}): McpConnectorDescriptor {
  return {
    id: 'ent-demo',
    displayName: '示例连接器',
    serverName: 'ent-demo',
    endpoint: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@mobilenext/mobile-mcp@latest'],
      env: [{ name: 'DEMO_TOKEN', key: 'ENT_DEMO_TOKEN' }],
    },
    ...overrides,
  }
}

/** 本进程创建过的临时 dshHome；`cleanupConnectorHomes` 在 afterEach 里统一删。 */
const createdHomes: string[] = []

export async function makeConnectorHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const path = await mkdtemp(join(root, 'dshent-connector-'))
  createdHomes.push(path)
  return path
}

export async function cleanupConnectorHomes(): Promise<void> {
  await Promise.all(createdHomes.splice(0).map(path => rm(path, { force: true, recursive: true })))
}

/** 与官方 `ChangeResult` 同形的成功结果。 */
export function appliedConnectorResult(
  target: string,
  application: ConnectorBundleApplication['application'] = 'applied',
): ConnectorBundleApplication {
  return { target, changed: true, application, stage: 'enable', enabled: true, warnings: [] }
}

export interface FakeConnectorPort {
  readonly port: ConnectorInstallPort
  readonly installCalls: string[]
  readonly removeCalls: string[]
  installResult: ConnectorBundleApplication
  removeResult: ConnectorBundleApplication
  installError: unknown
  removeError: unknown
  /** 若设，`installBundle` 先等它 resolve 再返回（用于「进行中」用例）。 */
  installGate?: Promise<void>
  /** 若设，装成后按官方行为在 `<profileDir>/node_modules` 留一枚指向 spec 的符号链接（卸载**不**清，正好让清理段去清）。 */
  linkOnInstall: boolean
  /** 若设，装成后写一枚**指向别处**的符号链接（用于「foreign-target 不碰」用例）。 */
  foreignLinkTarget?: string
  profileDir?: string
}

/**
 * 假安装端口。默认行为对齐官方实测（配方线 spike §3⑤）：装成后 `node_modules/<pkg>` 出现 link；卸载成功后 link **仍在**
 * —— 正好让 `cleanConnectorBundleLink` 有活干。
 */
export function createFakeConnectorPort(options: {
  readonly profileDir?: string
  readonly installResult?: ConnectorBundleApplication
  readonly removeResult?: ConnectorBundleApplication
  readonly linkOnInstall?: boolean
  readonly foreignLinkTarget?: string
} = {}): FakeConnectorPort {
  const state = {
    installCalls: [] as string[],
    removeCalls: [] as string[],
    installResult: options.installResult ?? appliedConnectorResult('dsh-ent-connector-ent-demo'),
    removeResult: options.removeResult ?? appliedConnectorResult('dsh-ent-connector-ent-demo'),
    installError: undefined as unknown,
    removeError: undefined as unknown,
    installGate: undefined as Promise<void> | undefined,
    linkOnInstall: options.linkOnInstall ?? true,
    foreignLinkTarget: options.foreignLinkTarget,
    profileDir: options.profileDir,
    port: undefined as unknown as ConnectorInstallPort,
  }
  const port: ConnectorInstallPort = {
    async installBundle(spec) {
      state.installCalls.push(spec)
      if (state.installGate !== undefined) await state.installGate
      if (state.installError !== undefined) throw state.installError
      if (state.profileDir !== undefined && (state.linkOnInstall || state.foreignLinkTarget !== undefined)) {
        const packageName = connectorBundlePackageName(packageNameFromSpec(spec))
        const linkPath = connectorLinkPath(state.profileDir, packageName)
        await mkdir(dirname(linkPath), { recursive: true, mode: 0o700 }).catch(() => undefined)
        await symlink(state.foreignLinkTarget ?? spec, linkPath).catch(() => undefined)
      }
      return state.installResult
    },
    async removeBundle(name) {
      state.removeCalls.push(name)
      if (state.removeError !== undefined) throw state.removeError
      return state.removeResult
    },
  }
  state.port = port
  return state as unknown as FakeConnectorPort
}

/** 从合成落点反推连接器 id：`<root>/<id>/<digest>` ⇒ `<id>`。 */
function packageNameFromSpec(spec: string): string {
  return spec.split('/').filter(part => part.length > 0).at(-2) ?? ''
}
