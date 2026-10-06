/**
 * [INPUT]: 依赖 node:crypto/fs/path、platform-client 的 `resolveEnterpriseDshHome`、`./errors.js` 的稳定码、`./bundle.js` 的合成段与落根/包名/摘要，以及 `../plugin-install-port.js` 的官方安装面（与配方纵深**共用同一份**面描述，不另造第二个安装器）
 * [OUTPUT]: 官方安装端口契约（`ConnectorInstallPort` / `officialConnectorInstallPort` / 两个 `*FromContext` 取值器）、本机已装清单（`InstalledConnectorRecord` / `readInstalledConnectors` / `writeInstalledConnectors`）、`node_modules/<包名>` link 残壳清理 `cleanConnectorBundleLink`、编排器 `createEnterpriseConnectorInstall`（幂等 + 并发拒绝 + 官方裁定三态原样透出 + 未验证项显式透出）
 * [POS]: bundle 连接器纵深的**安装段（P0-2 后半）**——官方唯一安装面是 `ctx.pluginManager.installBundle(spec)`（`docs/notes/preset-approval-spike.md` §4 实证：普通 Host 插件即可达、服务面零弹层、自带进度与取消）；本文件只把这条面**端口化**便于测试与替换，默认实现照原样转发、失败原样抛出（`cause` 保留官方错误），编排层负责稳定码、幂等、并发与三态。**授权门不在这里**：配方纵深把它放在 `preset/authorization.ts`，连接器的对应物是 P0-1 求值器（`./policy.ts`）+ P0-4 企业账本，本文件只做"把合成好的 bundle 交给官方"这一段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import {
  EnterpriseConnectorError,
  connectorBadRequest,
  connectorError,
  type EnterpriseConnectorErrorCode,
} from './errors.js'
import {
  CONNECTOR_ID_PATTERN,
  MAX_CONNECTOR_ID_LENGTH,
  MCP_SERVER_NAME_PATTERN,
  connectorBundlePackageName,
  connectorBundleRoot,
  renderConnectorBundle,
  synthesizeConnectorBundle,
  type McpConnectorDescriptor,
} from './bundle.js'
import {
  OFFICIAL_APPLICATIONS,
  isOfficialPluginManager,
  officialApplicationKind,
  pluginManagerFromContext,
  profileDirFromContext,
  projectOfficialResult,
  type OfficialApplication,
  type OfficialApplicationKind,
  type OfficialBundleApplication,
  type OfficialPluginManagerLike,
} from '../plugin-install-port.js'

/** 本机已装记录落点（`<dshHome>/enterprise/` 下）；与配方的 `preset-installs/` 平级但**互不混写**。 */
const CONNECTOR_INSTALL_DIR_SEGMENTS = ['enterprise', 'connector-installs'] as const
const CONNECTOR_INSTALL_FILENAME = 'installed.json'
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const HEX64_PATTERN = /^[0-9a-f]{64}$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const MAX_DISPLAY_NAME_LENGTH = 120
/** 记录键集**逐字**（读盘时精确比对；多一键少一键都判损坏，不放宽）。 */
const RECORD_KEYS = 'bundleDir,connectorId,digest,displayName,installedAt,officialApplication,packageName,serverName,version'

/** 官方 `ChangeResult.application` 的完整取值；**原样透出**，不由我们折叠。 */
export type ConnectorApplication = OfficialApplication

/** 给界面的三态（`hot` = 官方 `applied`；官方原值另存 `officialApplication`）。 */
export type ConnectorApplicationKind = OfficialApplicationKind

/** 官方安装/卸载结果的**受控投影**：只保留稳定字段，不放 pnpm 输出与宿主路径。 */
export type ConnectorBundleApplication = OfficialBundleApplication

/**
 * 「装完之后这一条连接器到位了没有」——`connector-architecture.md` §8.3 第 1 条。**这件事有两半，本文件分开登记**
 * （2026-10-06 第二次取证后；原文那一整条"客户端侧发起装 bundle 是否与会话内 `plugin_manager` 同一条面"
 * 早由配方线 spike 判定"已验证"，收窄后只剩后半句）：
 *
 * **① 行会不会进**运行中**的会话 —— 已判明，不需要重启。** 判据是官方自己的定义，不是我们的推断：
 *   · `dsh-plugin-manager/lib/index.js:2042` 逐字 `application: this.ownerContext.get("hmr") !== void 0 ? "applied" : "restart-required"`
 *     ⇒ **`applied` 的含义就是"现场有 HMR"**；
 *   · 同文件 `:1801` 的 enable 分支：**新装**（`Object.hasOwn(before, name)` 为假）才走 `await this.reload()`，
 *     而 `reload()` 就是 `reconcileProfilePatches(ownerContext.root, …)` —— 对**运行中的** Loader 树现场和解；
 *     ⇒ 新装 bundle 的 patch 行会在当前会话里挂上；
 *   · 官方 README `:67` 同义："A live profile recomposes, so the granted plugin mounts in the running session
 *     and the result reports `applied`"；
 *   · **本机档位实测**：`dsh --profile web --dump-config` 第 10 行就是 `- id: hmr / name: '@deepseek-ai/dsh-hmr'`
 *     ⇒ 本机 web profile 有 HMR ⇒ 我们这条安装拿到的是 `applied`。
 *   ★ 反过来也记一笔：**改配置**（同一包名已在 manifest 里）走 `:1801` 的 `return "restart-required"`
 *     ⇒ 首次安装是热的、**换端点要重启** —— 两种都由官方裁定，我们原样透出，不自己猜。
 *
 * **② 工具什么时候可调 —— 也已判明（由官方契约推出，不是读数）。** 三条官方代码串起来正好锁死这一格：
 *   · `dsh-app-boot/lib/index.js:3468` `reconcileProfilePatches` 在 `entry.update()` 之后
 *     **`await ctx.loader.await()`**（等整棵 Loader 树），随后 `inactiveEntries(ctx)` 把
 *     **`FIBER_PENDING` 也算未就绪**，只要**新引入**的行在其中就**当场抛**；
 *   · `dsh-mcp-client` 的 **`apply` 实现**（`lib/index.js:809`）：`:831` `const outcome = await connection.ready`，
 *     而 `ready`（`:679` 构造）只在 `:657` 的 `await enqueueSync(generation, startupOpts)` 成功后才 resolve ——
 *     工具正是在那里注册的（`:518` 的 `enqueueSync` → `:153` `ctx.tools.register(definition)`）；失败时 `ready`
 *     返回 `{error}`，`:832` 在 `failOnStartupError` 为真时**抛**（"initial connection or tool synchronization failed"）。
 *     ★ 这与 `lib/types/index.d.ts:89` 的类型注释逐字一致（"publish its initial tool generation before activation"）：
 *     类型注释是**承诺**，上面那三行才是**实现** —— 第十三刀把这一格从"契约级"升到"实现级已验"；
 *   · 我们在 P0-2 里把 `failOnStartupError` **恒设 `true`**（§4.2：宁可该行显式失败，也不要"看起来配好了但零工具"）。
 *   ⇒ 合起来：**`applied` 只会在"新行 ACTIVE"之后返回，而该行 ACTIVE 的定义里就包含"初始工具代已发布"**
 *   ⇒ 「HMR 已生效」与「工具已可用」在这次安装的**返回时刻**是同一件事。若服务器连不上，`reconcileProfilePatches`
 *   抛错 → manager 的 `change()` 捕获 → 回的是 `application: 'failed'`（不是 `applied`）。
 *   ★ 两条实作后果要记住：① 安装调用会**阻塞到握手结束**（stdio 起进程 / http 建连 + 首次 tools/list），
 *   服务器卡住时安装也卡住（由连接超时兜底）；② 上面这条依赖 `failOnStartupError: true` 这个 P0-2 决定，
 *   两者是**配对**的，改一个必须复核另一个。
 *
 * 仍未做的是**真机端到端读数**（临时 profile + 独立进程，装一条后立即查 `ctx.tools` 再重启复看）：
 * 它是本结论的独立复核与耗时测量，不是这条结论的前提。故本格恒为 `'proven-by-contract'`，
 * 拿到读数后改成 `'measured'` 并写清坐标。
 *
 * ★ `'proven-by-contract'` 这个值的含义（第十三刀扩过一次）：**契约（官方类型注释）与实现（`apply`/`ready`/
 * enqueueSync 三行）两侧都核过**，因此它是"由官方代码判明"，不是"由我们的推断判明"；
 * 与它相对的 `'unmeasured'` 是"两者都没有"、`'measured'` 是"另有真机读数"。三档互不替代。
 */
export type ConnectorToolAvailability = 'unmeasured' | 'proven-by-contract' | 'measured'

/** ★ 见 `ConnectorToolAvailability` 的长注释：结论由官方契约推出（尚未真机读数）。 */
export const CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL: ConnectorToolAvailability = 'proven-by-contract'

/**
 * 「要不要一个新会话才生效」**只**跟官方裁定走，不再替未验证项背锅（上一版对 `hot` 也保守地回 `true`，
 * 那是 ① 还没有证据时的正确取舍；`:2042` + `:1801` + README `:67` + 本机 `dump-config` 到手后，① 已经判明）：
 * · `hot`（官方 `applied`）⇒ 行已在运行中的会话里挂上 ⇒ **不需要**新会话；工具还差一次握手，由
 *   `toolAvailability` 那一格单独说明（界面用"正在连接…"表述，不用"请重启"）。
 * · 其余（`restart-required` / `overridden` / `failed` / `cancelled`）⇒ 要。
 */
function needsNewSessionFor(kind: ConnectorApplicationKind): boolean {
  return kind !== 'hot'
}

/** 注入式安装端口；默认实现直接转发官方 `ctx.pluginManager`（与 `PresetInstallPort` 同形、同一份官方面）。 */
export interface ConnectorInstallPort {
  installBundle(spec: string, options?: { readonly enabled?: boolean; readonly requestId?: string }): Promise<ConnectorBundleApplication>
  removeBundle(name: string): Promise<ConnectorBundleApplication>
}

/** 官方默认安装端口：**原样转发**，不吞任何异常（官方错误由编排层当 `cause` 保留）。 */
export function officialConnectorInstallPort(manager: OfficialPluginManagerLike): ConnectorInstallPort {
  if (!isOfficialPluginManager(manager)) {
    throw connectorBadRequest('official plugin manager does not expose installBundle/removeBundle')
  }
  return {
    async installBundle(spec, options) {
      return projectOfficialResult(spec, await manager.installBundle(spec, options ?? {}))
    },
    async removeBundle(name) {
      return projectOfficialResult(name, await manager.removeBundle(name))
    },
  }
}

/** 官方服务可达性：普通 Host 插件 `ctx.get('pluginManager')` 即可（spike §4 实证）。 */
export function connectorPluginManagerFromContext(ctx: { get(name: string): unknown }): OfficialPluginManagerLike | undefined {
  return pluginManagerFromContext(ctx)
}

/** 当前 profile 目录（`profileContext.dir`）；不在 profile 启动的进程里返回 undefined。 */
export function connectorProfileDirFromContext(ctx: { get(name: string): unknown }): string | undefined {
  return profileDirFromContext(ctx)
}

/** Host 组合层一行接线：`ctx.get('pluginManager')` 在就给官方安装端口，缺席即 undefined（fail-closed，不猜）。 */
export function officialConnectorInstallPortFromContext(
  ctx: { get(name: string): unknown },
): ConnectorInstallPort | undefined {
  const manager = connectorPluginManagerFromContext(ctx)
  return manager === undefined ? undefined : officialConnectorInstallPort(manager)
}

/** 一条已落盘的连接器安装记录；只保存脱敏事实（**绝不含**端点 URL 里的凭据、env 值或官方输出）。 */
export interface InstalledConnectorRecord {
  readonly connectorId: string
  readonly serverName: string
  readonly displayName: string
  readonly packageName: string
  readonly bundleDir: string
  readonly digest: string
  readonly version: string
  readonly installedAt: string
  readonly officialApplication: ConnectorApplication
}

export interface ConnectorInstallStateOptions {
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
}

export interface EnterpriseConnectorInstallOptions extends ConnectorInstallStateOptions {
  readonly port: ConnectorInstallPort
  /** 目标 profile 目录（`node_modules` 的父目录）；Host 侧用 `connectorProfileDirFromContext(ctx)`。 */
  readonly profileDir: string
  readonly now?: () => Date
  readonly onError?: (message: string, error: unknown) => void
}

export interface ConnectorInstallResult {
  readonly ok: boolean
  readonly connectorId: string
  readonly application: ConnectorApplicationKind
  readonly officialApplication?: ConnectorApplication
  /** 模型看到的工具名前缀 `mcp__<serverName>__`；失败早期阶段可能缺席。 */
  readonly toolNamePrefix?: string
  readonly bundleDir?: string
  readonly digest?: string
  readonly installedNames: readonly string[]
  /** 官方裁定"要新会话才生效"（`application !== 'hot'`）；`hot` = 行已在运行中的会话里挂上（见 `ConnectorToolAvailability` ①）。 */
  readonly needsNewSession: boolean
  /** ★ 恒为 `CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL`；`proven-by-contract` ⇒ `applied` 时工具已注册。 */
  readonly toolAvailability: ConnectorToolAvailability
  readonly alreadyInstalled?: boolean
  readonly errorCode?: EnterpriseConnectorErrorCode
  readonly officialError?: { readonly code?: string }
  readonly warnings?: readonly string[]
}

export interface ConnectorUninstallResult {
  readonly ok: boolean
  readonly connectorId: string
  readonly application: ConnectorApplicationKind
  readonly officialApplication?: ConnectorApplication
  readonly removedNames: readonly string[]
  readonly linkRemoved: boolean
  readonly errorCode?: EnterpriseConnectorErrorCode
  readonly warnings?: readonly string[]
}

export interface EnterpriseConnectorInstallStatus {
  readonly installs: readonly InstalledConnectorRecord[]
  readonly busy: readonly string[]
}

/** 安装器：同一实例内做「重复点不重装、进行中拒绝、失败不禁用」的全部编排。 */
export interface EnterpriseConnectorInstall {
  status(): Promise<EnterpriseConnectorInstallStatus>
  install(descriptor: McpConnectorDescriptor): Promise<ConnectorInstallResult>
  uninstall(connectorId: string): Promise<ConnectorUninstallResult>
  busy(connectorId?: string): boolean
}

/** 读本机已装清单；不存在即空，损坏一律 fail-closed（**绝不**当空清单继续装第二遍）。 */
export async function readInstalledConnectors(
  options: ConnectorInstallStateOptions = {},
): Promise<readonly InstalledConnectorRecord[]> {
  let text: string
  try {
    text = await readFile(connectorInstalledStatePath(options), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw connectorError(error, 'ENT_CONNECTOR_STATE_INVALID', 'installed connector state could not be read')
  }
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new EnterpriseConnectorError('ENT_CONNECTOR_STATE_INVALID', 'installed connector state is not valid JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).join(',') !== 'records'
    || !Array.isArray((value as { records?: unknown }).records)) {
    throw new EnterpriseConnectorError('ENT_CONNECTOR_STATE_INVALID', 'installed connector state has an invalid shape')
  }
  const records: InstalledConnectorRecord[] = []
  for (const item of (value as { records: unknown[] }).records) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new EnterpriseConnectorError('ENT_CONNECTOR_STATE_INVALID', 'installed connector record is not an object')
    }
    const row = item as Record<string, unknown>
    const connectorId = row['connectorId']
    if (Object.keys(row).sort().join(',') !== RECORD_KEYS
      || typeof connectorId !== 'string' || !CONNECTOR_ID_PATTERN.test(connectorId) || connectorId.length > MAX_CONNECTOR_ID_LENGTH
      || typeof row['serverName'] !== 'string' || !MCP_SERVER_NAME_PATTERN.test(row['serverName'])
      || typeof row['displayName'] !== 'string' || row['displayName'].length === 0 || row['displayName'].length > MAX_DISPLAY_NAME_LENGTH
      || row['packageName'] !== connectorBundlePackageName(connectorId)
      || typeof row['bundleDir'] !== 'string' || !isAbsolute(row['bundleDir'])
      || typeof row['digest'] !== 'string' || !HEX64_PATTERN.test(row['digest'])
      || typeof row['version'] !== 'string' || !SEMVER_PATTERN.test(row['version'])
      || typeof row['installedAt'] !== 'string' || !Number.isFinite(Date.parse(row['installedAt']))
      || !(OFFICIAL_APPLICATIONS as readonly unknown[]).includes(row['officialApplication'])) {
      throw new EnterpriseConnectorError('ENT_CONNECTOR_STATE_INVALID', 'installed connector record has invalid fields')
    }
    records.push({
      connectorId,
      serverName: row['serverName'],
      displayName: row['displayName'],
      packageName: row['packageName'],
      bundleDir: row['bundleDir'],
      digest: row['digest'],
      version: row['version'],
      installedAt: row['installedAt'],
      officialApplication: row['officialApplication'] as ConnectorApplication,
    })
  }
  return records
}

/** 原子写已装清单：同目录临时件 + rename（与 `preset/install.ts`、`skill-install.ts` 同一套纪律）。 */
export async function writeInstalledConnectors(
  options: ConnectorInstallStateOptions,
  records: readonly InstalledConnectorRecord[],
): Promise<void> {
  const path = connectorInstalledStatePath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(temporary, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw connectorError(error, 'ENT_CONNECTOR_STATE_INVALID', 'installed connector state could not be written')
  }
}

function connectorInstalledStatePath(options: ConnectorInstallStateOptions): string {
  return join(resolveEnterpriseDshHome(options), ...CONNECTOR_INSTALL_DIR_SEGMENTS, CONNECTOR_INSTALL_FILENAME)
}

/** 目标 profile 下的 `node_modules/<包名>` 落点。 */
export function connectorLinkPath(profileDir: string, packageName: string): string {
  return join(profileDir, 'node_modules', ...packageName.split('/'))
}

/** link 是否仍然存在（不跟随符号链接；hoisted linker 下官方可能铺成**实体目录**，同样算存在）。 */
export async function connectorLinkExists(profileDir: string, packageName: string): Promise<boolean> {
  try {
    await lstat(connectorLinkPath(profileDir, packageName))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export type ConnectorLinkCleanupReason = 'removed' | 'absent' | 'not-a-symbolic-link' | 'foreign-target' | 'failed'

export interface ConnectorLinkCleanupOptions extends ConnectorInstallStateOptions {
  readonly profileDir: string
  readonly onError?: (message: string, error: unknown) => void
}

export interface ConnectorLinkCleanupResult {
  readonly removed: boolean
  readonly reason: ConnectorLinkCleanupReason
}

/**
 * 清掉官方 `removeBundle` **不会**清的那一枚 `node_modules/<pkg>` link 残壳（配方线 spike §3⑤ 实证：官方不动它）。
 *
 * 三道 fail-closed（与 `cleanPresetBundleLink` **同一套**判据，只是根换成本纵深的 `connector-bundles`）：
 * ① 只认符号链接——实体目录/文件**一律不碰**（本机 `nodeLinker: hoisted` 会把 spec 铺成实体目录，
 * 那种情况只回 `not-a-symbolic-link` 并由编排层记 warning：宁可留残壳，也不误删不可证明属于我们的东西）；
 * ② 符号链接的**解析目标**必须落在我们的 `<dshHome>/enterprise/connector-bundles` 内；
 * ③ 目标校验用符号链接本体的解析值（raw 与 realpath 两种写法都认），不看包名猜。
 * 清理范围**只**是 `node_modules`；官方 `.plugin-manager/logs/*` 是审计，绝不触碰。
 */
export async function cleanConnectorBundleLink(
  options: ConnectorLinkCleanupOptions,
  packageName: string,
): Promise<ConnectorLinkCleanupResult> {
  if (typeof packageName !== 'string' || !PACKAGE_NAME_PATTERN.test(packageName) || packageName.length > 128) {
    throw connectorBadRequest('package name is invalid')
  }
  const linkPath = connectorLinkPath(options.profileDir, packageName)
  let info
  try {
    info = await lstat(linkPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { removed: false, reason: 'absent' }
    return { removed: false, reason: 'failed' }
  }
  if (!info.isSymbolicLink()) return { removed: false, reason: 'not-a-symbolic-link' }
  let target: string
  try {
    const raw = await readlink(linkPath)
    target = isAbsolute(raw) ? resolve(raw) : resolve(dirname(linkPath), raw)
  } catch {
    return { removed: false, reason: 'failed' }
  }
  if (!await isInsideConnectorBundleRoot(options, target)) return { removed: false, reason: 'foreign-target' }
  try {
    await rm(linkPath, { force: false })
    const parent = dirname(linkPath)
    if (parent !== join(options.profileDir, 'node_modules')) {
      const siblings = await readdir(parent).catch(() => ['keep'])
      if (siblings.length === 0) await rm(parent, { force: true, recursive: false }).catch(() => undefined)
    }
    return { removed: true, reason: 'removed' }
  } catch (error) {
    options.onError?.('connector link cleanup failed', error)
    return { removed: false, reason: 'failed' }
  }
}

/** 落点是否落在我们的 bundle 根内（raw 与 realpath 两种写法都认，Android 符号链接不误判）。 */
async function isInsideConnectorBundleRoot(options: ConnectorInstallStateOptions, candidate: string): Promise<boolean> {
  const roots = new Set<string>([resolve(connectorBundleRoot(options))])
  try {
    roots.add(resolve(await realpath(connectorBundleRoot(options))))
  } catch {
    // 根不存在时只按字面路径判定。
  }
  let real: string | undefined
  try {
    real = resolve(await realpath(candidate))
  } catch {
    real = undefined
  }
  for (const root of roots) {
    const normalized = resolve(root)
    if (candidate === normalized || candidate.startsWith(normalized + sep)) return true
    if (real !== undefined && (real === normalized || real.startsWith(normalized + sep))) return true
  }
  return false
}

/** 组装安装器；`port` 是唯一外部依赖，测试用假端口即可覆盖全部分支。 */
export function createEnterpriseConnectorInstall(options: EnterpriseConnectorInstallOptions): EnterpriseConnectorInstall {
  const inFlight = new Set<string>()
  const report = (message: string, error: unknown): void => {
    options.onError?.(message, error)
  }

  async function status(): Promise<EnterpriseConnectorInstallStatus> {
    return { installs: await readInstalledConnectors(options), busy: [...inFlight].sort() }
  }

  async function install(descriptor: McpConnectorDescriptor): Promise<ConnectorInstallResult> {
    const rawId = (descriptor as unknown as { id?: unknown } | null | undefined)?.id
    let rendered
    try {
      // 纯函数先渲染一次：拿到身份与内容摘要（合成段随后会再渲染一次，字节确定故结果相同）。
      rendered = renderConnectorBundle(descriptor)
    } catch (error) {
      const failure = connectorError(error, 'ENT_CONNECTOR_DECLARATION_INVALID', 'connector descriptor is not installable')
      report('connector descriptor rejected', failure)
      return {
        ok: false,
        connectorId: typeof rawId === 'string' ? rawId : '',
        application: 'other',
        installedNames: [],
        needsNewSession: false,
        toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
        errorCode: failure.code,
      }
    }
    const connectorId = rendered.connectorId
    const base = {
      connectorId,
      toolNamePrefix: rendered.toolNamePrefix,
      digest: rendered.digest,
    }
    // 幂等/并发：同一连接器重复点不重装；进行中再点**拒绝**（不排队），并让调用方去 status() 看进度。
    if (inFlight.has(connectorId)) {
      return {
        ...base,
        ok: false,
        application: 'other',
        installedNames: [],
        needsNewSession: false,
        toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
        errorCode: 'ENT_CONNECTOR_INSTALL_IN_PROGRESS',
      }
    }
    inFlight.add(connectorId)
    try {
      const installs = await readInstalledConnectors(options)
      const existing = installs.find(item => item.connectorId === connectorId)
      if (existing !== undefined
        && existing.digest === rendered.digest
        && await connectorLinkExists(options.profileDir, existing.packageName)) {
        return {
          ...base,
          ok: true,
          application: officialApplicationKind(existing.officialApplication),
          officialApplication: existing.officialApplication,
          installedNames: [existing.packageName],
          needsNewSession: needsNewSessionFor(officialApplicationKind(existing.officialApplication)),
          toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
          alreadyInstalled: true,
          bundleDir: existing.bundleDir,
        }
      }
      let synthesized
      try {
        synthesized = await synthesizeConnectorBundle(options, descriptor)
      } catch (error) {
        const failure = connectorError(error, 'ENT_CONNECTOR_BUNDLE_WRITE_FAILED', 'connector bundle could not be synthesized')
        report('connector bundle synthesis failed', failure)
        return {
          ...base,
          ok: false,
          application: 'other',
          installedNames: [],
          needsNewSession: false,
          toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
          errorCode: failure.code,
        }
      }
      let applied: ConnectorBundleApplication
      try {
        applied = await options.port.installBundle(synthesized.bundleDir, { enabled: true })
      } catch (error) {
        // 官方失败**原样**保留在 cause 与 onError 里，界面只拿稳定码。
        report('connector bundle install failed', error)
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          installedNames: [],
          needsNewSession: false,
          toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
          errorCode: 'ENT_CONNECTOR_INSTALL_FAILED',
          bundleDir: synthesized.bundleDir,
        }
      }
      if (applied.application === 'failed') {
        report('connector bundle install reported failure', applied.error)
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'failed',
          installedNames: [],
          needsNewSession: false,
          toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
          errorCode: 'ENT_CONNECTOR_INSTALL_FAILED',
          bundleDir: synthesized.bundleDir,
          ...(applied.error?.code === undefined ? {} : { officialError: { code: applied.error.code } }),
        }
      }
      if (applied.application === 'cancelled') {
        return {
          ...base,
          ok: false,
          application: 'other',
          officialApplication: 'cancelled',
          installedNames: [],
          needsNewSession: false,
          toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
          errorCode: 'ENT_CONNECTOR_INSTALL_CANCELLED',
          bundleDir: synthesized.bundleDir,
        }
      }
      const record: InstalledConnectorRecord = {
        connectorId,
        serverName: rendered.serverName,
        displayName: rendered.displayName,
        packageName: rendered.packageName,
        bundleDir: synthesized.bundleDir,
        digest: rendered.digest,
        version: rendered.version,
        installedAt: (options.now ?? (() => new Date()))().toISOString(),
        officialApplication: applied.application,
      }
      await writeInstalledConnectors(
        options,
        [...installs.filter(item => item.connectorId !== connectorId), record]
          .sort((left, right) => left.connectorId.localeCompare(right.connectorId)),
      )
      const kind = officialApplicationKind(applied.application)
      return {
        ...base,
        ok: true,
        application: kind,
        officialApplication: applied.application,
        installedNames: [rendered.packageName],
        needsNewSession: needsNewSessionFor(kind),
        toolAvailability: CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
        bundleDir: synthesized.bundleDir,
        ...(applied.warnings === undefined ? {} : { warnings: applied.warnings }),
      }
    } finally {
      inFlight.delete(connectorId)
    }
  }

  async function uninstall(connectorId: string): Promise<ConnectorUninstallResult> {
    const id = typeof connectorId === 'string'
      && CONNECTOR_ID_PATTERN.test(connectorId)
      && connectorId.length <= MAX_CONNECTOR_ID_LENGTH
      ? connectorId
      : undefined
    if (id === undefined) {
      return {
        ok: false,
        connectorId: String(connectorId),
        application: 'other',
        removedNames: [],
        linkRemoved: false,
        errorCode: 'ENT_INVALID_REQUEST',
      }
    }
    if (inFlight.has(id)) {
      return {
        ok: false,
        connectorId: id,
        application: 'other',
        removedNames: [],
        linkRemoved: false,
        errorCode: 'ENT_CONNECTOR_INSTALL_IN_PROGRESS',
      }
    }
    inFlight.add(id)
    try {
      const installs = await readInstalledConnectors(options)
      const record = installs.find(item => item.connectorId === id)
      if (record === undefined) {
        return {
          ok: false,
          connectorId: id,
          application: 'other',
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_RESOURCE_NOT_FOUND',
        }
      }
      let removed: ConnectorBundleApplication
      try {
        removed = await options.port.removeBundle(record.packageName)
      } catch (error) {
        report('connector bundle removal failed', error)
        return {
          ok: false,
          connectorId: id,
          application: 'other',
          officialApplication: 'failed',
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_CONNECTOR_UNINSTALL_FAILED',
        }
      }
      if (removed.application === 'failed') {
        report('connector bundle removal reported failure', removed.error)
        return {
          ok: false,
          connectorId: id,
          application: 'other',
          officialApplication: 'failed',
          removedNames: [],
          linkRemoved: false,
          errorCode: 'ENT_CONNECTOR_UNINSTALL_FAILED',
        }
      }
      const cleanup = await cleanConnectorBundleLink(options, record.packageName)
      await writeInstalledConnectors(options, installs.filter(item => item.connectorId !== id))
      const warnings = [
        ...(removed.warnings ?? []),
        ...(cleanup.removed || cleanup.reason === 'absent' ? [] : [`node_modules link not removed: ${cleanup.reason}`]),
      ]
      return {
        ok: true,
        connectorId: id,
        application: officialApplicationKind(removed.application),
        officialApplication: removed.application,
        removedNames: [record.packageName],
        linkRemoved: cleanup.removed,
        ...(warnings.length === 0 ? {} : { warnings }),
      }
    } finally {
      inFlight.delete(id)
    }
  }

  return {
    status,
    install,
    uninstall,
    busy: (connectorId?: string) => connectorId === undefined ? inFlight.size > 0 : inFlight.has(connectorId),
  }
}
