/**
 * [INPUT]: 依赖 platform-client bootstrap/request、安装层验签开关、Harness inventory、**官方 `pluginManager` 安装面**（经 `./manager.ts` 的端口）、制品校验与原子状态文件
 * [OUTPUT]: 对外提供企业可选目录（条目含 `displayName` 标题与可选 `description`）、显式安装/版本切换/卸载、**取消在途安装**、**启用与停用**、撤回调和、核心保护与库存状态
 * [POS]: plugin-distribution 的串行生命周期所有者，中心决定可用范围，用户决定本机安装，Loader 确认重启结果；
 *        安装/卸载的最后一步是官方 `installBundle`/`removeBundle`（不再有 `dsh plugin` 子进程），
 *        官方的进度（`plugin-manager/install-state` / `install-log`）与取消（`cancelInstall` / `waitForInstall`）
 *        因此真的对我们生效
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { Service } from '@deepseek-ai/cordis'
import { zPluginInventoryResponse, zRuntimePluginAssignmentsResponse, type ManagedPluginState } from '@dshent/contracts'
import { resolveEnterpriseDshHome, type BootstrapSnapshot } from '@dshent/platform-client'
import { distributionError, PluginDistributionError } from './errors.js'
import {
  readInstallLogChunk,
  readInstallProgress,
  unavailableManagedPluginManagerPort,
  type ManagedPluginCancellation,
  type ManagedPluginChangeResult,
  type ManagedPluginManagerPort,
} from './manager.js'
import { ManagedPluginStore } from './state-store.js'
import type {
  ManagedPluginRecord,
  PluginDistributionConfig,
  PluginDistributionContext,
  PluginDistributionStatus,
  RuntimePluginAssignment,
} from './types.js'
import { downloadAndVerifyArtifact, parseTrustedPluginPublicKey, verifyAssignmentMetadata } from './verification.js'
import type { CompatibilityWarning } from './verification.js'

/** 企业安装包拥有、通用分发绝不能更新或卸载的完整产品代码集合。 */
export const PROTECTED_ENTERPRISE_PACKAGES = new Set([
  'dshent-plugin',
  '@dshent/contracts',
  '@dshent/llm-gateway',
  '@dshent/platform-client',
  '@dshent/plugin-distribution',
  '@dshent/ui',
])
const DSHENT_PACKAGE = 'dshent-plugin'

/** 官方 pnpm 运行日志留在宿主日志里的尾巴长度（只进日志，绝不进状态文件或响应体）。 */
const OFFICIAL_LOG_TAIL_LENGTH = 2_000

interface ResolvedConfig {
  readonly verifyPluginSignatures: boolean
  readonly trustedPublicKey?: ReturnType<typeof parseTrustedPluginPublicKey>
  readonly harnessCommit?: string
  readonly bundleVersion: string
  readonly dshHome: string
}

export interface PluginDistributionInternals {
  readonly operatingSystem?: NodeJS.Platform
  readonly now?: () => Date
  readonly runMarker?: string
  readonly store?: ManagedPluginStore
  /**
   * 官方安装面端口（`./manager.ts`）。bundle 组合层经官方 inject 声明**延迟**接线后交进来；
   * 缺席即 fail-closed 端口（每次调用抛 `ENT_PLUGIN_CLI_FAILED`），**绝不**回落到第二条安装通道。
   */
  readonly pluginManager?: ManagedPluginManagerPort
}

function resolveConfig(config: PluginDistributionConfig): ResolvedConfig {
  if (config.harnessCommit !== undefined && !/^[0-9a-f]{40}$/.test(config.harnessCommit)) {
    throw new TypeError('harnessCommit must be a full lowercase commit')
  }
  if (config.bundleVersion.length === 0) throw new TypeError('bundleVersion is required')
  return {
    verifyPluginSignatures: config.verifyPluginSignatures ?? false,
    ...(config.verifyPluginSignatures !== true || config.trustedPluginPublicKey === undefined || config.trustedPluginPublicKey.trim() === ''
      ? {}
      : { trustedPublicKey: parseTrustedPluginPublicKey(config.trustedPluginPublicKey) }),
    ...(config.harnessCommit === undefined ? {} : { harnessCommit: config.harnessCommit }),
    bundleVersion: config.bundleVersion,
    dshHome: resolveEnterpriseDshHome(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
  }
}

function cloneRecord(record: ManagedPluginRecord): ManagedPluginRecord {
  return { ...record }
}

function sameArtifact(record: ManagedPluginRecord | undefined, assignment: RuntimePluginAssignment): boolean {
  return record?.desiredState === 'INSTALLED'
    && record.version === assignment.version
    && record.sha256 === assignment.sha256
}

/**
 * 官方 `ChangeResult` 的失败事实 → 我们的稳定码。
 *
 * 只做**一处**语义映射：官方 `incompatible-version`（`dsh-plugin-manager/lib/index.js:1786-1787`：官方先按
 * `dsh.bundle` 判 `not-bundle`，再跑 `evaluatePluginCompatibility`）与我们的 `ENT_PLUGIN_INCOMPATIBLE` 是同一件事（制品与当前引擎不兼容），
 * 复用同一枚码与同一句员工文案；其余官方码（`not-bundle`/`ambiguous-install`/`invalid-spec`/
 * `operation-error`…）一律落到 `ENT_PLUGIN_CLI_FAILED`（「插件安装工具执行失败」——官方 `pluginManager`
 * 就是那件安装工具），**不**新造码，官方原码与诊断进 `cause` 与宿主日志。
 */
function officialFailureCode(outcome: ManagedPluginChangeResult): PluginDistributionError['code'] {
  return outcome.error?.code === 'incompatible-version' ? 'ENT_PLUGIN_INCOMPATIBLE' : 'ENT_PLUGIN_CLI_FAILED'
}

/**
 * 官方失败事实（`application` / `error.code` / `diagnostic` / `failedAt`）→ 一个 Error 充当 `cause`。
 *
 * 只放**官方说的话**与我们自己的包名，不放 pnpm 输出、`logPath` 或制品路径；`cause` 只进宿主日志，
 * 绝不进状态文件、库存或响应体（`fail()` 只取稳定码）。
 */
function officialFailureCause(packageName: string, outcome: ManagedPluginChangeResult): Error {
  return new Error('official plugin manager reported '
    + `application=${outcome.application} packageName=${packageName}`
    + `${outcome.error?.code === undefined ? '' : ` code=${outcome.error.code}`}`
    + `${outcome.failedAt === undefined ? '' : ` failedAt=${outcome.failedAt}`}`
    + `${outcome.error?.diagnostic === undefined ? '' : ` diagnostic=${outcome.error.diagnostic}`}`)
}

/** 官方失败 → 我们的稳定错误（`cause` 保留官方失败事实，绝不吞）。 */
function officialFailure(
  packageName: string,
  outcome: ManagedPluginChangeResult,
  message: string,
): PluginDistributionError {
  return new PluginDistributionError(officialFailureCode(outcome), message, {
    cause: officialFailureCause(packageName, outcome),
  })
}

/** 受管插件调和 Service；同一时刻只有一个 revision worker 可以触碰文件或官方安装面。 */
export class EnterprisePluginDistributionService extends Service {
  static inject = ['enterprisePlatform', 'pluginInventory']

  private readonly pluginContext: PluginDistributionContext
  private readonly config: ResolvedConfig
  private readonly store: ManagedPluginStore
  private readonly runMarker: string
  private readonly operatingSystem: NodeJS.Platform
  private readonly now: () => Date
  /** 官方安装面（`pluginManager`）；缺席即 fail-closed 端口。 */
  private readonly pluginManager: ManagedPluginManagerPort
  private readonly abort = new AbortController()
  private readonly records = new Map<string, ManagedPluginRecord>()
  private readonly unsubscribe: () => void
  private readonly startup: Promise<void>
  /** 官方 pnpm 每一跑的尾巴（按 jobId），只在日志里用，跑完即丢。 */
  private readonly officialLogTails = new Map<string, string[]>()

  private assignmentRevision = 0
  private lastReconciledRevision = -1
  private pending: BootstrapSnapshot | undefined
  private worker: Promise<void> | undefined
  private pluginActionTask: Promise<void> | undefined
  private uninstallTask: Promise<void> | undefined
  /**
   * 在途官方安装的句柄：`cancelInstall`/`waitForInstall` 要的 requestId 只在这里。
   *
   * 同一时刻只有一个（`changePlugin` 拒并发），故一枚字段足够；安装一落定就清空。
   */
  private installHandle: { readonly packageName: string; readonly requestId: string } | undefined
  private fatalErrorCode: string | undefined
  private lastReportErrorCode: string | undefined
  private uninstalling = false
  private disposed = false

  constructor(
    ctx: PluginDistributionContext,
    config: PluginDistributionConfig,
    internals: PluginDistributionInternals = {},
  ) {
    super(ctx, 'enterprisePluginDistribution')
    this.pluginContext = ctx
    this.config = resolveConfig(config)
    this.store = internals.store ?? new ManagedPluginStore(this.config.dshHome)
    this.runMarker = internals.runMarker ?? randomUUID()
    this.operatingSystem = internals.operatingSystem ?? process.platform
    this.now = internals.now ?? (() => new Date())
    this.pluginManager = internals.pluginManager ?? unavailableManagedPluginManagerPort()
    this.startup = this.loadState().catch((error: unknown) => {
      this.fatalErrorCode = distributionError(
        error, 'ENT_PLUGIN_STATE_INVALID', 'managed plugin state could not be loaded',
      ).code
    })
    this.unsubscribe = ctx.enterprisePlatform.subscribe(status => {
      if (status.state === 'READY') this.schedule(ctx.enterprisePlatform.bootstrap())
    })
    if (ctx.enterprisePlatform.status().state === 'READY') this.schedule(ctx.enterprisePlatform.bootstrap())
    this.subscribeOfficialProgress()
    ctx.effect(() => () => this.dispose(), 'enterprisePluginDistribution.dispose()')
  }

  /**
   * 订阅官方两枚事件（进度 + pnpm 输出），**只**认我们自己在跑的那一枚 requestId。
   *
   * 为什么不把官方进度直接塞进线协议：只读路由 `GET /enterprise/api/v1/local/plugins` 的响应是
   * **关闭键集**（`ui/src/local-api-decode.ts` 的 `hasExactKeys`），加一个字段就要 ui 与解码器同批改；
   * 而官方 `install-state` 的三种 phase（`installing`/`applying`/`cancelling`）在本包既有的
   * `ManagedPluginState` 里没有对应值 —— 故这里只做两件不碰线协议的事：
   *   ① 把官方阶段写进**宿主日志**（可见判据：这一次安装官方走到哪一步、问的是哪个 registry）；
   *   ② 把官方 pnpm 输出的**尾巴**留给失败诊断（`step=official-log-exit`），绝不留存、绝不外发。
   * 界面拿的进度仍是既有那条只读路由的 `plugins[].state`（安装期间恒为 `INSTALLING`，见 `put()`）。
   */
  private subscribeOfficialProgress(): void {
    const events = this.pluginContext as unknown as {
      on(name: 'plugin-manager/install-state', listener: (progress: unknown) => void): () => void
      on(name: 'plugin-manager/install-log', listener: (chunk: unknown) => void): () => void
    }
    this.pluginContext.effect(() => {
      const offState = events.on('plugin-manager/install-state', progress => {
        this.observeOfficialProgress(progress)
      })
      const offLog = events.on('plugin-manager/install-log', chunk => {
        this.observeOfficialLog(chunk)
      })
      return () => {
        offState()
        offLog()
      }
    }, 'enterprisePluginDistribution.officialProgress')
  }

  /** 官方阶段 → 宿主日志；只有我们自己在途的那一枚 requestId 才留痕。 */
  private observeOfficialProgress(value: unknown): void {
    const active = this.installHandle
    if (active === undefined) return
    const progress = readInstallProgress(value)
    if (progress === undefined || progress.requestId !== active.requestId) return
    const attempt = progress.attempt
    this.pluginContext.logger.info(
      'owndsh: official plugin manager reports install progress'
      + ` [operation=managedPluginInstall step=official-${progress.phase} packageName=${active.packageName}`
      + (attempt === undefined
        ? ''
        : ` registry=${attempt.registry ?? '(configured)'} attempt=${attempt.index}/${attempt.total}`)
      + ']',
    )
  }

  /** 官方 pnpm 输出 → 只在那一跑结束时留一条宿主日志（失败 warn、成功 debug），带尾巴便于诊断。 */
  private observeOfficialLog(value: unknown): void {
    const active = this.installHandle
    if (active === undefined) return
    const chunk = readInstallLogChunk(value)
    if (chunk === undefined || chunk.requestId !== active.requestId) return
    const tail = [...this.officialLogTails.get(chunk.jobId) ?? [], chunk.text]
    if (chunk.exitCode === undefined) {
      // 有界：只留最后 OFFICIAL_LOG_TAIL_LENGTH 个字符，绝不无限增长。
      this.officialLogTails.set(chunk.jobId, tail.join('').slice(-OFFICIAL_LOG_TAIL_LENGTH).split('\n'))
      return
    }
    this.officialLogTails.delete(chunk.jobId)
    const text = tail.join('').slice(-OFFICIAL_LOG_TAIL_LENGTH).trim()
    const line = 'owndsh: official plugin manager finished a package run'
      + ` [operation=managedPluginInstall step=official-log-exit packageName=${active.packageName}`
      + ` jobId=${chunk.jobId} exitCode=${String(chunk.exitCode)}]`
      + (text === '' ? '' : `\n${text}`)
    if (chunk.exitCode === 0) this.pluginContext.logger.debug(line)
    else this.pluginContext.logger.warn(line)
  }

  /** 返回状态文件事实的副本，不包含 tgz 路径、公钥、官方 pnpm 输出或平台凭据。 */
  status(): PluginDistributionStatus {
    const platform = this.pluginContext.enterprisePlatform
    const connected = !this.disposed && ['READY', 'REFRESHING'].includes(platform.status().state)
    return {
      assignmentRevision: this.assignmentRevision,
      catalog: (connected ? platform.bootstrap()?.plugins.assignments ?? [] : [])
        .filter(item => item.desiredState === 'INSTALLED' && !PROTECTED_ENTERPRISE_PACKAGES.has(item.packageName))
        .map(item => {
          let installErrorCode: string | undefined
          let warnings: readonly CompatibilityWarning[] = []
          try {
            warnings = verifyAssignmentMetadata(item, this.config.trustedPublicKey, {
              ...this.config, operatingSystem: this.operatingSystem,
            }, this.config.verifyPluginSignatures)
          } catch (error) {
            installErrorCode = distributionError(error, 'ENT_PLUGIN_INCOMPATIBLE', 'plugin is unavailable').code
          }
          // 降级警告只记 Host 日志，**不进** status() 线协议：加一个 catalog 字段就得同批改
          // 客户端 schema 与 UI，本刀刻意不造这种连锁（见本会话教训）。
          // 本刀（description）正是那种「连锁字段」，故它是**同批**改完的那一个：契约（PluginDescription）→
          // platform-client 的 bootstrap `.strict()` → 这里的 catalog 投影 → ui 的解码白名单与卡片，
          // 四处一起上，不存在「服务端先发字段、客户端不认」的中间态。
          for (const warning of warnings) {
            this.reportCompatibilityWarning(item.packageName, item.version, warning)
          }
          return {
            pluginVersionId: item.pluginVersionId, packageName: item.packageName, version: item.version,
            // 制品 package.json 的 displayName：服务端必有值（验包器缺省回退包名），故**有就原样带走**；
            // 只有旧服务端（这一刀之前那批 bootstrap 不带该键）才会缺席，ui 的白名单与渲染层据此回退包名。
            ...(item.displayName === undefined ? {} : { displayName: item.displayName }),
            // 制品 package.json 的 description：服务端**没有就整个键缺席**（不造空串），故这里同样只在
            // 真拿到非空值时带着走——下游（ui 解码白名单是关闭键集）据此把「没有这个键」当唯一缺失口径。
            ...(item.description === undefined ? {} : { description: item.description }),
            // 制品 tar 里那份 README 的纯文本（口径 20）：与 `description` **同一口径**——服务端解不出
            // README 时整个键缺席（不造空串、不编造），故这里也只在真拿到非空值时带着走。
            ...(item.readme === undefined ? {} : { readme: item.readme }),
            sizeBytes: item.sizeBytes, operatingSystems: [...item.compatibility.operatingSystems],
            ...(installErrorCode === undefined ? {} : { installErrorCode }),
          }
        }),
      plugins: [...this.records.values()].sort((left, right) => left.packageName.localeCompare(right.packageName))
        .map(cloneRecord),
      ...(this.fatalErrorCode === undefined ? {} : { fatalErrorCode: this.fatalErrorCode }),
      ...(this.lastReportErrorCode === undefined ? {} : { lastReportErrorCode: this.lastReportErrorCode }),
    }
  }

  /** 兼容性降级（"无法确证"）只记 Host 日志：既有 wire 契约不含告警位，也不在本刀新增。 */
  private reportCompatibilityWarning(packageName: string, version: string, warning: CompatibilityWarning): void {
    this.pluginContext.logger.warn(
      `owndsh: managed plugin ${packageName}@${version} proceeds with compatibility warning ${warning.code}: ${warning.message}`,
    )
  }

  /** 测试与有界关闭使用：等待当前已排队 revision 完全停稳。 */
  async settled(): Promise<void> {
    await this.startup
    while (this.worker !== undefined || this.pluginActionTask !== undefined) {
      await (this.worker ?? this.pluginActionTask)?.catch(() => undefined)
    }
  }

  /** 版本 ID 绑定用户看见的版本；重新请求中心授权，即使 tgz 已缓存也不能绕过撤回。 */
  install(packageName: string, pluginVersionId: string): Promise<void> {
    return this.changePlugin(async () => {
      const platform = this.pluginContext.enterprisePlatform
      const identity = this.currentIdentity()
      const response = await platform.request('/enterprise/api/v1/plugins/assignments', { signal: this.abort.signal })
      if (!response.ok) throw new PluginDistributionError('ENT_PERMISSION_DENIED', 'plugin catalog is unavailable')
      const catalog = zRuntimePluginAssignmentsResponse.parse(await response.json()).data
      const candidate = catalog.assignments.find(item => item.packageName === packageName
        && item.pluginVersionId === pluginVersionId && item.desiredState === 'INSTALLED')
      if (candidate === undefined || identity !== this.currentIdentity()) {
        throw new PluginDistributionError('ENT_PERMISSION_DENIED', 'plugin is no longer available')
      }
      const assignment = { ...candidate, sizeBytes: Number(candidate.sizeBytes) }
      if (!Number.isSafeInteger(assignment.sizeBytes)) throw new PluginDistributionError(
        'ENT_PLUGIN_SIZE_MISMATCH', 'plugin size exceeds the supported range',
      )
      this.requireUnprotected(packageName)
      this.assignmentRevision = catalog.revision
      const before = this.records.get(packageName)
      try {
        await this.reconcileInstalled(assignment, identity)
      } catch (error) {
        // 用户按了取消（官方 `cancelInstall`）：这不是失败 —— 官方已经把 package.json/lock 回滚，
        // 本机没有发生任何变化，故把记录恢复成安装前那一条（本来没有就删掉），绝不留下假的 FAILED。
        if (error instanceof PluginDistributionError && error.code === 'ENT_PLUGIN_INSTALL_CANCELLED') {
          await this.restoreBeforeInstall(packageName, before)
          throw error
        }
        if (!this.disposed) await this.fail(assignment, error)
        throw error
      }
    })
  }

  /** 本机卸载不依赖目录中仍有该插件，也不改变其他设备的选择。 */
  remove(packageName: string): Promise<void> {
    return this.changePlugin(async () => {
      this.requireUnprotected(packageName)
      const current = this.records.get(packageName)
      if (current === undefined) throw new PluginDistributionError('ENT_PERMISSION_DENIED', 'plugin is not managed')
      if (current.desiredState === 'ABSENT' && current.state === 'RESTART_REQUIRED') return
      this.records.set(packageName, { ...current, desiredState: 'ABSENT', state: 'REMOVING' })
      await this.persist()
      try {
        await this.removeThroughOfficialManager(packageName)
        this.records.set(packageName, {
          ...current, desiredState: 'ABSENT', state: 'RESTART_REQUIRED', lastErrorCode: null, restartMarker: this.runMarker,
        })
      } catch (error) {
        this.records.set(packageName, {
          ...current, state: 'FAILED', lastErrorCode: distributionError(
            error, 'ENT_PLUGIN_CLI_FAILED', 'plugin removal failed',
          ).code, restartMarker: null,
        })
        throw error
      } finally {
        await this.persist()
      }
    })
  }

  /**
   * 用户显式**启用 / 停用**一枚已安装的插件。
   *
   * 与装/卸**同一条链**：同一个串行闸 `changePlugin`（同一时刻只允许一件插件操作）→ 同一个官方
   * profile 面 `setBundleEnabled`（只改 profile manifest 的 `dsh.profile.bundles`，**不卸载依赖**）
   * → 同一个收束口径（与非 hot 的装/卸一致：`RESTART_REQUIRED` + runMarker，由**下一进程**的
   * `confirmRestartedState` 按 Loader 事实确认）→ 同一份库存上报。
   *
   * `enabled` 是本机私有位（`types.ts`），与 `desiredState`（装/卸，中心决定）正交：停用**不**改
   * `desiredState`、不删版本/摘要，故那一行仍以既有目录事实在「已安装」页出现。
   * 幂等：已经是这一格就不打扰官方；官方 `application: failed` 一律 fail-closed 抛出、记录不动。
   *
   * @param packageName - 已安装的受管 package 名。
   * @param enabled - `true` = 启用，`false` = 停用。
   */
  setEnabled(packageName: string, enabled: boolean): Promise<void> {
    return this.changePlugin(async () => {
      this.requireUnprotected(packageName)
      const current = this.records.get(packageName)
      // 只有**已安装**的受管行可拨：中心已撤回（`desiredState: 'ABSENT'`）或本机没记录时没有任何可启停的运行面，
      // 若照样打官方 `setBundleEnabled(true)`，就会把刚撤回的 bundle 偷偷加回 profile。
      if (current === undefined || current.desiredState !== 'INSTALLED') {
        throw new PluginDistributionError('ENT_PERMISSION_DENIED', 'plugin is not managed')
      }
      if (current.enabled === enabled) return
      await this.setEnabledThroughOfficialManager(packageName, enabled)
      // 记录：`desiredState` 不变（装没装正交），只翻启停位；等重启由 restartMarker 表达（与卸载同一口径）。
      this.records.set(packageName, {
        ...current,
        enabled,
        state: 'RESTART_REQUIRED',
        lastErrorCode: null,
        restartMarker: this.runMarker,
      })
      await this.persist()
    })
  }

  /**
   * 取消**在途**的官方安装（界面「取消」这一次是真的）。
   *
   * 与安装/卸载不同，取消**不**经 `changePlugin`（那正是要被打断的那条路），而是直接拿官方句柄：
   *   · `cancelled` —— 官方已 abort 掉 pnpm/Git 检查并**等文件回滚完成**（`application: 'cancelled'`），
   *     在途的 `install()` 会以 `ENT_PLUGIN_INSTALL_CANCELLED` 收束，本机记录回到安装前；
   *   · `too-late` —— 官方已经把 bundle 交给应用阶段（`applying`），取消不可达；此时用 `waitForInstall`
   *     **不取消地**把官方真实结果取回来记进宿主日志（如实交代，不猜）；
   *   · `not-running` —— 没有这个 requestId 在跑（包括官方换过实例、安装早已落定）。
   *
   * @param packageName - 要取消的那一行；与在途安装的包名不一致即按 `not-running` 如实回。
   * @returns 官方的闭集取值；调用方（本机路由）据此留痕。
   */
  async cancel(packageName: string): Promise<ManagedPluginCancellation> {
    const active = this.installHandle
    if (active === undefined || active.packageName !== packageName) {
      this.pluginContext.logger.info(
        `owndsh: nothing to cancel for ${packageName} [operation=managedPluginCancel step=not-running]`,
      )
      return { status: 'not-running' }
    }
    let outcome: ManagedPluginCancellation
    try {
      outcome = await this.pluginManager.cancelInstall(active.requestId)
    } catch (error) {
      // 官方端口在（服务撤下/销毁）抛错时：如实留痕并如实告诉调用方「这次没取消」，绝不假装成功。
      this.pluginContext.logger.warn(
        `owndsh: official cancelInstall rejected the request [operation=managedPluginCancel step=threw`
        + ` packageName=${packageName} requestId=${active.requestId}]`,
        error,
      )
      return { status: 'not-running' }
    }
    this.pluginContext.logger.info(
      'owndsh: official plugin manager answered the cancellation'
      + ` [operation=managedPluginCancel step=${outcome.status} packageName=${packageName} requestId=${active.requestId}]`,
    )
    if (outcome.status === 'too-late') {
      try {
        const settled = await this.pluginManager.waitForInstall(active.requestId)
        this.pluginContext.logger.info(
          'owndsh: the official installation was already applying; its own outcome is reported instead'
          + ` [operation=managedPluginCancel step=too-late-outcome packageName=${packageName}`
          + ` application=${settled?.application ?? '(settled)'}]`,
        )
      } catch (error) {
        this.pluginContext.logger.warn(
          `owndsh: waitForInstall failed after a too-late cancellation [operation=managedPluginCancel step=too-late-threw`
          + ` packageName=${packageName}]`,
          error,
        )
      }
    }
    return outcome
  }

  private currentIdentity(): string {
    const platform = this.pluginContext.enterprisePlatform
    const snapshot = platform.bootstrap()
    if (!['READY', 'REFRESHING'].includes(platform.status().state) || snapshot === undefined) {
      throw new PluginDistributionError('ENT_AUTH_REQUIRED', 'enterprise login is required')
    }
    return JSON.stringify([platform.status().platformUrl, snapshot.user.id, snapshot.device.id])
  }

  private requireUnprotected(packageName: string): void {
    if (PROTECTED_ENTERPRISE_PACKAGES.has(packageName)) throw new PluginDistributionError(
      'ENT_PLUGIN_CORE_PROTECTED', 'enterprise core packages are installation-owned',
    )
  }

  private changePlugin(operation: () => Promise<void>): Promise<void> {
    if (this.pluginActionTask !== undefined || this.uninstalling || this.disposed) {
      return Promise.reject(new PluginDistributionError('ENT_PLUGIN_BUSY', 'another plugin operation is in progress'))
    }
    const worker = this.worker
    const task = (async () => {
      await this.startup
      await worker
      if (this.disposed) throw new PluginDistributionError('ENT_PLUGIN_BUSY', 'plugin service is disposed')
      this.currentIdentity()
      if (this.fatalErrorCode !== undefined) throw new PluginDistributionError(
        'ENT_PLUGIN_STATE_INVALID', 'managed plugin state is unavailable',
      )
      await operation()
      await this.reportInventory()
    })().finally(() => {
      if (this.pluginActionTask === task) this.pluginActionTask = undefined
      if (this.pending !== undefined && !this.disposed) this.schedule(this.pending)
    })
    this.pluginActionTask = task
    return task
  }

  /** 显式移除全部已安装受管包和 DSH Enterprise 自身；调用方在响应成功后负责请求宿主重启。 */
  uninstall(): Promise<void> {
    if (this.disposed) return Promise.reject(new PluginDistributionError(
      'ENT_PLUGIN_CLI_FAILED', 'plugin distribution is disposed',
    ))
    if (this.uninstallTask !== undefined) return this.uninstallTask
    this.uninstalling = true
    this.pending = undefined
    this.unsubscribe()
    const operation = this.runUninstall().catch((error: unknown) => {
      if (this.uninstallTask === operation) this.uninstallTask = undefined
      this.uninstalling = false
      throw error
    })
    this.uninstallTask = operation
    return operation
  }

  /**
   * 中止下载、**取消在途的官方安装**、取消平台订阅，并等待唯一 worker 退出。
   *
   * 旧的 CLI 通道靠 `signal` 随 `this.abort` 一起断；换成官方服务面之后，官方那一跑用的是
   * 它自己的 `AbortController`（`lib/index.js:1693`），我们的 signal 到不了它——所以关闭要走
   * 官方**唯一**的取消面 `cancelInstall`，否则「有界关闭」会退化成等 pnpm 跑完。
   */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.abort.abort(new DOMException('plugin distribution disposed', 'AbortError'))
    const active = this.installHandle
    if (active !== undefined) {
      try {
        await this.pluginManager.cancelInstall(active.requestId)
      } catch (error) {
        this.pluginContext.logger.warn(
          `owndsh: cancelling the in-flight official install on shutdown failed`
          + ` [operation=managedPluginInstall step=dispose-cancel-threw packageName=${active.packageName}]`,
          error,
        )
      }
    }
    await this.settled()
  }

  private async loadState(): Promise<void> {
    const state = await this.store.read()
    this.assignmentRevision = state.assignmentRevision
    for (const record of state.plugins) {
      this.records.set(record.packageName, ['ACTIVE', 'FAILED', 'RESTART_REQUIRED'].includes(record.state)
        ? record : { ...record, state: 'FAILED', lastErrorCode: 'ENT_PLUGIN_CLI_FAILED', restartMarker: null })
    }
  }

  private schedule(snapshot: BootstrapSnapshot | undefined): void {
    if (snapshot === undefined || this.disposed || this.uninstalling) return
    this.pending = snapshot
    if (this.worker !== undefined || this.pluginActionTask !== undefined) return
    const worker = this.drain().catch((error: unknown) => {
      this.fatalErrorCode = distributionError(
        error, 'ENT_PLUGIN_STATE_INVALID', 'plugin reconciliation failed unexpectedly',
      ).code
    }).finally(() => {
      if (this.worker === worker) this.worker = undefined
      if (this.pending !== undefined && !this.disposed) this.schedule(this.pending)
    })
    this.worker = worker
  }

  private async drain(): Promise<void> {
    await this.startup
    if (this.fatalErrorCode !== undefined) {
      this.pending = undefined
      return
    }
    while (this.pending !== undefined && !this.disposed) {
      const snapshot = this.pending
      this.pending = undefined
      await this.reconcile(snapshot)
    }
  }

  private async reconcile(snapshot: BootstrapSnapshot): Promise<void> {
    await this.confirmRestartedState()
    if (snapshot.plugins.revision !== this.lastReconciledRevision) {
      this.assignmentRevision = snapshot.plugins.revision
      const seen = new Set<string>()
      for (const assignment of snapshot.plugins.assignments) {
        if (seen.has(assignment.packageName)) {
          await this.fail(assignment, new PluginDistributionError(
            'ENT_PLUGIN_STATE_INVALID', 'bootstrap contains duplicate plugin assignments',
          ))
          continue
        }
        seen.add(assignment.packageName)
        const current = this.records.get(assignment.packageName)
        if (assignment.desiredState === 'ABSENT' && current !== undefined) {
          await this.reconcileWithdrawal(assignment)
        } else if (sameArtifact(current, assignment) && current !== undefined) {
          await this.refreshDesiredRevision(assignment, current)
        }
      }
      this.lastReconciledRevision = snapshot.plugins.revision
      await this.persist()
    }
    await this.reportInventory()
  }

  private async confirmRestartedState(): Promise<void> {
    let changed = false
    for (const record of [...this.records.values()]) {
      const entry = await this.loaderEntry(record.packageName)
      const active = entry?.enabled === true && entry.fiberPhase === 'active'
      // 用户停用的那一行**本来就不该** active（bundle 已从 profile 层摘掉，entry 甚至可能整条消失）——
      // 这不是失败。故下面每一处判活/判死的分支都必须把这一枚本机位算进去，否则刚停用的一行会在下一进程
      // 被自己的调和器打成 `ENT_PLUGIN_LOADER_INACTIVE`（交接书点名的「最易漏三处」之一）。
      const disabled = record.enabled === false
      if (record.state === 'RESTART_REQUIRED') {
        if (record.restartMarker === this.runMarker) continue
        if (record.desiredState === 'ABSENT' && entry === undefined) {
          this.records.delete(record.packageName)
        } else if (record.desiredState === 'INSTALLED' && (active || disabled)) {
          // 停用且已安装：无论 Loader 里是「entry 不在了」还是「entry 仍 disabled」，都如实收束为 ACTIVE
          // （「已安装 · 已停用」= ACTIVE + enabled:false；线协议里没有第三格，不新造状态值）。
          this.records.set(record.packageName, {
            ...record,
            state: 'ACTIVE',
            lastErrorCode: null,
            restartMarker: null,
          })
        } else {
          this.records.set(record.packageName, {
            ...record,
            state: 'FAILED',
            lastErrorCode: 'ENT_PLUGIN_LOADER_INACTIVE',
            restartMarker: null,
          })
        }
        changed = true
      } else if (record.state === 'ACTIVE' && !active && !disabled) {
        this.records.set(record.packageName, {
          ...record,
          state: 'FAILED',
          lastErrorCode: 'ENT_PLUGIN_LOADER_INACTIVE',
        })
        changed = true
      }
    }
    if (changed) await this.persist()
  }

  private async reconcileWithdrawal(assignment: RuntimePluginAssignment): Promise<void> {
    try {
      this.requireUnprotected(assignment.packageName)
      await this.reconcileAbsent(assignment)
    } catch (error) {
      if (this.disposed && this.abort.signal.aborted) return
      await this.fail(assignment, error)
    }
  }

  private async reconcileInstalled(assignment: RuntimePluginAssignment, identity: string): Promise<void> {
    const trustedPublicKey = this.config.trustedPublicKey
    verifyAssignmentMetadata(assignment, trustedPublicKey, {
      ...this.config, operatingSystem: this.operatingSystem,
    }, this.config.verifyPluginSignatures)
    const current = this.records.get(assignment.packageName)
    // 用户停用的这一行 + **同一枚制品** ⇒ 只跟中心 revision，绝不重新走安装：
    // `installBundle` 的 `enabled: true` 会把用户的停用**偷偷开回来**（交接书点名的「最易漏三处」之二）。
    if (current?.enabled === false && sameArtifact(current, assignment)) {
      await this.refreshDesiredRevision(assignment, current)
      return
    }
    if (sameArtifact(current, assignment)) {
      if (current?.state === 'ACTIVE' && await this.loaderActive(assignment.packageName)) {
        await this.refreshDesiredRevision(assignment, current)
        return
      }
      if (current?.state === 'RESTART_REQUIRED') {
        await this.refreshDesiredRevision(assignment, current)
        return
      }
    }
    if (current?.state === 'ACTIVE' && current.version !== assignment.version) {
      await this.put(assignment, 'ROLLBACK')
    }
    await this.put(assignment, 'DOWNLOAD_PENDING')
    await this.put(assignment, 'DOWNLOADING')
    const artifactPath = await downloadAndVerifyArtifact({
      platform: this.pluginContext.enterprisePlatform,
      assignment,
      dshHome: this.config.dshHome,
      verifyPluginSignatures: this.config.verifyPluginSignatures,
      ...(trustedPublicKey === undefined ? {} : { trustedPublicKey }),
      ...(this.config.harnessCommit === undefined ? {} : { harnessCommit: this.config.harnessCommit }),
      bundleVersion: this.config.bundleVersion,
      operatingSystem: this.operatingSystem,
      signal: this.abort.signal,
      warn: warning => this.reportCompatibilityWarning(assignment.packageName, assignment.version, warning),
    })
    if (identity !== this.currentIdentity()) throw new PluginDistributionError(
      'ENT_PERMISSION_DENIED', 'enterprise account changed during installation',
    )
    await this.put(assignment, 'VERIFIED')
    await this.put(assignment, 'INSTALLING')
    const outcome = await this.installThroughOfficialManager(assignment, artifactPath, current?.enabled ?? true)
    await this.applyInstalledApplication(assignment, outcome)
  }

  /**
   * 下载与校验之后的**最后一步**：把本地制品交给官方 `installBundle`。
   *
   * 交出去的是**绝对 tarball 路径**（内容寻址的 `<dshHome>/enterprise/artifacts/<sha256>.tgz`）：
   * 官方 `parseInstallSpec`（`dsh-plugin-manager/lib/types/install-spec.js:61-65`）按 tarball 收，
   * 且 `checkGithubConnection`（同包 `lib/index.js:968-969`）对非 git 形状直接返回，故本地制品不发任何多余网络请求。
   *
   * `requestId` 由**我们**生成并随 `options` 交进去：它同时是取消句柄（`cancelInstall`）与
   * 在途结果句柄（`waitForInstall`），也是官方两枚进度事件里 `requestId` 的来源（用来认领属于我们的事件）。
   *
   * `enabled` 取本机记录的启停位：用户停用过的那一枚换版本时仍保持停用（**绝不**借安装之机把开关拨回去）。
   */
  private async installThroughOfficialManager(
    assignment: RuntimePluginAssignment,
    artifactPath: string,
    enabled: boolean,
  ): Promise<ManagedPluginChangeResult> {
    const requestId = randomUUID()
    this.installHandle = { packageName: assignment.packageName, requestId }
    try {
      return await this.pluginManager.installBundle(artifactPath, { enabled, requestId })
    } catch (error) {
      // 官方极少数**抛错**路径（拿不到 profile 写锁 / 服务被销毁 / 端口不可用）：原样保留 cause，不吞不折。
      throw distributionError(error, 'ENT_PLUGIN_CLI_FAILED', 'official plugin installation failed')
    } finally {
      this.installHandle = undefined
      this.officialLogTails.clear()
    }
  }

  /**
   * 官方 `application` 三态 → 本包受管态：**如实透出**，不折叠。
   *
   * | 官方 `application`   | 本包记录                       | 为什么 |
   * | -------------------- | ------------------------------ | ------ |
   * | `applied`（hot）     | `ACTIVE`（Loader 复核通过时）／否则 `RESTART_REQUIRED` | 官方口径 = patch 已在**本进程**生效（profile 有 `dsh-hmr` 时才可能），故不无条件写 RESTART_REQUIRED；但最终以 Loader 事实为准，复核不过就保守等重启 |
   * | `restart-required`   | `RESTART_REQUIRED` + runMarker | 官方口径 = 落盘了但要重启才生效（**换版本**必落这一支：官方 `lib/index.js:1801` 对已存在的依赖直接返回 restart-required） |
   * | `failed` / `overridden` / 未知 | 抛稳定码（记录由 `fail()` 收束为 `FAILED`） | fail-closed：不假装成功；官方 `error.code`/`diagnostic` 进 `cause` 与宿主日志 |
   * | `cancelled`          | 抛 `ENT_PLUGIN_INSTALL_CANCELLED`，记录**回到安装前**（`install()` 专门处理） | 用户自己按的取消不是失败：本机什么都没变，不留一句假的「失败」 |
   */
  private async applyInstalledApplication(
    assignment: RuntimePluginAssignment,
    outcome: ManagedPluginChangeResult,
  ): Promise<void> {
    this.reportOfficialOutcome(assignment.packageName, outcome, 'install')
    if (outcome.application === 'applied') {
      // 官方说 hot（patch 已在本进程生效）；**再用 Loader 事实复核一次**——本服务一向以 Loader 为准
      // （`confirmRestartedState` 的 ACTIVE 校验同理）。复核失败时保守记 RESTART_REQUIRED：既不会谎报
      // 「已生效」，也不会在下一拍被 `confirmRestartedState` 打成 `ENT_PLUGIN_LOADER_INACTIVE`。
      if (await this.loaderActive(assignment.packageName)) {
        await this.put(assignment, 'ACTIVE')
        return
      }
      this.pluginContext.logger.warn(
        `owndsh: the official plugin manager applied ${assignment.packageName} hot but the Loader does not`
        + ' report it active yet; keeping RESTART_REQUIRED [operation=managedPluginInstall step=hot-unconfirmed]',
      )
      await this.put(assignment, 'RESTART_REQUIRED', null, this.runMarker)
      return
    }
    if (outcome.application === 'restart-required') {
      await this.put(assignment, 'RESTART_REQUIRED', null, this.runMarker)
      return
    }
    if (outcome.application === 'cancelled') {
      throw new PluginDistributionError(
        'ENT_PLUGIN_INSTALL_CANCELLED',
        'the official plugin manager cancelled this installation',
        { cause: officialFailureCause(assignment.packageName, outcome) },
      )
    }
    // 'failed' 与任何我们没见过的 application（含只可能来自 setPluginEnabled 的 'overridden'）一律如实失败。
    throw officialFailure(assignment.packageName, outcome, 'plugin installation failed')
  }

  /**
   * 把一枚已安装插件的启停意愿交给官方 `setBundleEnabled`（只改 profile 的 bundle 层，**不**动依赖）。
   *
   * 与安装/卸载同一收束口径：官方 `application: failed`/`overridden`/`cancelled` 一律按失败抛出
   * （`fail()` 不参与——调用方在成功之后才写记录）；官方码与诊断原样进 `cause` 与宿主日志，不吞不折。
   * 这里没有 requestId：官方这一枚变更不接受取消，因此**不**进在途句柄、也不产生进度事件。
   */
  private async setEnabledThroughOfficialManager(
    packageName: string,
    enabled: boolean,
  ): Promise<ManagedPluginChangeResult> {
    let outcome: ManagedPluginChangeResult
    try {
      outcome = await this.pluginManager.setBundleEnabled(packageName, enabled)
    } catch (error) {
      throw distributionError(error, 'ENT_PLUGIN_CLI_FAILED', 'official plugin enablement change failed')
    }
    this.reportOfficialOutcome(packageName, outcome, enabled ? 'enable' : 'disable')
    if (outcome.application === 'failed' || outcome.application === 'overridden' || outcome.application === 'cancelled') {
      throw officialFailure(packageName, outcome, 'official plugin enablement change failed')
    }
    return outcome
  }

  /**
   * 官方 `removeBundle` 的卸载。
   *
   * `node_modules` 残壳口径**逐字不变**：旧 CLI 的 `dsh plugin remove` 与官方服务面跑的是**同一条 pnpm remove**
   * （CLI 走 `plugin-manager/operations` 的 `runPluginCommand`，服务面走 `PluginManager.removeBundle`），
   * 两者都只清依赖与 link；配方那条 `cleanPresetBundleLink`（`preset/install.ts`）只服务 `pnpm add <目录>`
   * 造出的符号链接残壳，与本条无关，保持原样不动。
   *
   * `applied` 与 `restart-required` 在本包**同一收束口径**：记录留 `RESTART_REQUIRED` + runMarker，
   * 由**下一进程**的 `confirmRestartedState` 按 Loader 事实收尾（旧 CLI 路径连 `application` 都拿不到，
   * 现在官方口径至少如实进了宿主日志；线协议的受管态闭集里没有「已即时卸载生效」这一格，
   * 故这一处不新造字段，也不谎报）。
   */
  private async removeThroughOfficialManager(packageName: string): Promise<void> {
    let outcome: ManagedPluginChangeResult
    try {
      outcome = await this.pluginManager.removeBundle(packageName)
    } catch (error) {
      throw distributionError(error, 'ENT_PLUGIN_CLI_FAILED', 'official plugin removal failed')
    }
    this.reportOfficialOutcome(packageName, outcome, 'remove')
    if (outcome.application === 'failed' || outcome.application === 'overridden' || outcome.application === 'cancelled') {
      throw officialFailure(packageName, outcome, 'official plugin removal failed')
    }
  }

  /** 官方结果如实进宿主日志：成功 info 一条（含 application/stage/registry 尝试），失败 warn 一条（含官方码）。 */
  private reportOfficialOutcome(
    packageName: string,
    outcome: ManagedPluginChangeResult,
    direction: 'install' | 'remove' | 'enable' | 'disable',
  ): void {
    const operation = direction === 'install' ? 'managedPluginInstall'
      : direction === 'remove' ? 'managedPluginRemove'
      : direction === 'enable' ? 'managedPluginEnable' : 'managedPluginDisable'
    const detail = `application=${outcome.application} changed=${String(outcome.changed)}`
      + `${outcome.stage === undefined ? '' : ` stage=${outcome.stage}`}`
      + `${outcome.bundle === undefined ? '' : ` bundle=${outcome.bundle}`}`
      + `${outcome.error?.code === undefined ? '' : ` code=${outcome.error.code}`}`
      + `${outcome.failedAt === undefined ? '' : ` failedAt=${outcome.failedAt}`}`
      + `${outcome.registries === undefined
        ? ''
        : ` registries=${outcome.registries.map(entry => entry ?? '(configured)').join('>')}`}`
      + `${outcome.pendingBuilds === undefined ? '' : ` pendingBuilds=${outcome.pendingBuilds.join(',')}`}`
    const message = 'owndsh: official plugin manager outcome'
      + ` [operation=${operation}`
      + ` step=official-outcome packageName=${packageName} ${detail}]`
      + `${outcome.error?.diagnostic === undefined ? '' : `\n${outcome.error.diagnostic}`}`
    if (outcome.application === 'applied' || outcome.application === 'restart-required') {
      this.pluginContext.logger.info(message)
    } else {
      this.pluginContext.logger.warn(message)
    }
    for (const warning of outcome.warnings ?? []) {
      this.pluginContext.logger.warn(`owndsh: official plugin manager warned about ${packageName}: ${warning}`)
    }
  }

  private async refreshDesiredRevision(
    assignment: RuntimePluginAssignment,
    current: ManagedPluginRecord,
  ): Promise<void> {
    if (current.desiredRevision === this.assignmentRevision) return
    await this.put(assignment, current.state, current.lastErrorCode, current.restartMarker)
  }

  private async reconcileAbsent(assignment: RuntimePluginAssignment): Promise<void> {
    const current = this.records.get(assignment.packageName)
    if (current?.desiredState === 'ABSENT' && current.state === 'RESTART_REQUIRED') return
    const entry = await this.loaderEntry(assignment.packageName)
    const profileMayContainPlugin = current?.desiredState === 'INSTALLED' || entry !== undefined
    if (!profileMayContainPlugin) {
      if (current !== undefined) {
        this.records.delete(assignment.packageName)
        await this.persist()
      }
      return
    }
    await this.put(assignment, 'REMOVE_PENDING')
    await this.put(assignment, 'REMOVING')
    await this.removeThroughOfficialManager(assignment.packageName)
    await this.put(assignment, 'RESTART_REQUIRED', null, this.runMarker)
  }

  private async runUninstall(): Promise<void> {
    await this.settled()
    if (this.fatalErrorCode !== undefined) {
      throw new PluginDistributionError('ENT_PLUGIN_STATE_INVALID', 'managed plugin state is unavailable')
    }
    const records = [...this.records.values()].sort((left, right) => left.packageName.localeCompare(right.packageName))
    for (const record of records) {
      if (record.desiredState === 'INSTALLED'
        || record.state === 'FAILED' && await this.loaderEntry(record.packageName) !== undefined) {
        await this.removeThroughOfficialManager(record.packageName)
      }
    }
    this.records.clear()
    await this.persist()
    await this.removeThroughOfficialManager(DSHENT_PACKAGE)
  }

  private async put(
    assignment: RuntimePluginAssignment,
    state: ManagedPluginState,
    lastErrorCode: string | null = null,
    restartMarker: string | null = null,
  ): Promise<void> {
    const current = this.records.get(assignment.packageName)
    // `ACTIVE`（官方 hot `applied`）与 `RESTART_REQUIRED` 都是「官方已经把这枚制品落到盘上」的终态，
    // 故版本/摘要取 assignment；其余中间态保留既有值——`ROLLBACK` 那一步必须留着旧版本，直到新制品真的落定。
    const settled = state === 'RESTART_REQUIRED' || state === 'ACTIVE'
    this.records.set(assignment.packageName, {
      packageName: assignment.packageName,
      version: settled ? assignment.version : current?.version ?? null,
      sha256: settled ? assignment.sha256 : current?.sha256 ?? null,
      // 启停位是**用户的本机意愿**，与装/卸、与每一次状态迁移都正交：整条覆盖记录时原样继承，
      // 缺失即首次安装 ⇒ `true`。否则 `setEnabled` 的成功会被下一次 `put` 抹掉（交接书点名的三处之一）。
      enabled: current?.enabled ?? true,
      desiredRevision: this.assignmentRevision,
      desiredState: assignment.desiredState,
      state,
      lastErrorCode,
      restartMarker,
    })
    await this.persist()
  }

  /**
   * 取消后把记录恢复成安装前那一条（本来没有就删掉）。
   *
   * 官方取消的语义是「package.json/pnpm-lock.yaml 已回滚」（`dsh-plugin-manager/lib/types/index.d.ts:107-117`
   * 的 `installBundle` 文档：「A run that fails, is cancelled, or adds a package without a bundle patch restores
   * `package.json` and `pnpm-lock.yaml`」），本机没有发生变化 ⇒ 先前的 `ACTIVE`（例如换版本时被回滚到的那一版）必须原样留着，
   * 而不能被这次取消抹成 FAILED 或凭空删掉。
   */
  private async restoreBeforeInstall(
    packageName: string,
    before: ManagedPluginRecord | undefined,
  ): Promise<void> {
    if (before === undefined) this.records.delete(packageName)
    else this.records.set(packageName, before)
    await this.persist()
  }

  private async fail(assignment: RuntimePluginAssignment, error: unknown): Promise<void> {
    const failure = distributionError(error, 'ENT_PLUGIN_DOWNLOAD_FAILED', 'plugin reconciliation failed')
    await this.put(assignment, 'FAILED', failure.code)
  }

  private async persist(): Promise<void> {
    await this.store.write({
      formatVersion: 1,
      assignmentRevision: this.assignmentRevision,
      plugins: [...this.records.values()],
    })
  }

  private async loaderEntry(packageName: string): Promise<Awaited<ReturnType<PluginDistributionContext['pluginInventory']['list']>>['entries'][number] | undefined> {
    const inventory = await this.pluginContext.pluginInventory.list()
    const entries = inventory.entries.filter(entry => entry.moduleName === packageName)
    return entries.find(entry => entry.enabled && entry.fiberPhase === 'active') ?? entries[0]
  }

  private async loaderActive(packageName: string): Promise<boolean> {
    const entry = await this.loaderEntry(packageName)
    return entry?.enabled === true && entry.fiberPhase === 'active'
  }

  private async reportInventory(): Promise<void> {
    const items = await Promise.all([...this.records.values()].map(async record => {
      const entry = await this.loaderEntry(record.packageName)
      return {
        packageName: record.packageName,
        version: record.version,
        sha256: record.sha256,
        desiredRevision: record.desiredRevision,
        state: record.state,
        loaderPhase: entry?.fiberPhase ?? null,
        lastErrorCode: record.lastErrorCode,
        observedAt: this.now().toISOString(),
      }
    }))
    try {
      const response = await this.pluginContext.enterprisePlatform.request('/enterprise/api/v1/plugins/inventory', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
        signal: this.abort.signal,
      })
      const parsed = zPluginInventoryResponse.parse(await response.json())
      if (parsed.data.reported !== items.length) throw new Error('inventory acknowledgement count mismatch')
      this.lastReportErrorCode = undefined
    } catch (error) {
      if (!this.disposed) {
        this.lastReportErrorCode = distributionError(
          error, 'ENT_PLUGIN_DOWNLOAD_FAILED', 'plugin inventory report failed',
        ).code
      }
    }
  }
}

export default EnterprisePluginDistributionService
