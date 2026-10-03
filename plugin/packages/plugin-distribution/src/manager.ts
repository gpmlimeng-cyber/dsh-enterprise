/**
 * [INPUT]: 只依赖官方 `pluginManager` 的**结构面**（不 import 官方包，保持本包的 peer 边界）与 `./errors.js` 的稳定码
 * [OUTPUT]: 对外提供受管安装边界的端口契约 `ManagedPluginManagerPort`（`installBundle` / `removeBundle` / `setBundleEnabled` / `waitForInstall` / `cancelInstall`）、
 *           官方 `ChangeResult` → `ManagedPluginChangeResult` 的逐字段受控投影 `makeManagedPluginManagerPort`、
 *           从宿主 ctx 读官方服务 `managedPluginManagerFromContext`、缺席时的 fail-closed 端口 `unavailableManagedPluginManagerPort`
 *           与**晚绑定持有者** `createLateBoundManagedPluginManagerPort`
 * [POS]: plugin-distribution 的**唯一**安装/卸载/取消边界——从 `dsh plugin` 子进程换成官方服务面之后，
 *        官方那套进度与取消对我们**真的**生效：`plugin-manager/install-state`（阶段，含每一次 registry 尝试）、
 *        `plugin-manager/install-log`（pnpm 逐块输出）、`waitForInstall`（不取消也能取回在途结果）、
 *        `cancelInstall`（真的中止 pnpm 并等文件回滚完成，返回 `cancelled`/`too-late`/`not-running`）。
 *
 * 官方形状（逐条按实物核实，非推测）：
 *   · `installBundle(spec, options?)` —— `@deepseek-ai/dsh-plugin-manager/lib/types/index.d.ts:118`；
 *     `spec` 的接受面由 `lib/types/install-spec.js:61-65` 的 `parseInstallSpec` 决定：**绝对路径**目录（kind `path`）
 *     或**绝对路径 tarball**（`.tgz`/`.tar.gz`，kind `tarball`）都收 —— 我们交出去的是内容寻址的
 *     `<dshHome>/enterprise/artifacts/<sha256>.tgz`（`./verification.ts` 的 `downloadAndVerifyArtifact`），
 *     正好落在 tarball 那一支；非 git 形状连 GitHub 连接检查都跳过（`lib/index.js:968-969` 的
 *     `checkGithubConnection` 对 `kind !== 'git'` 直接返回 undefined），故本地制品不发任何多余网络请求。
 *   · `removeBundle(name)` —— 同文件 `:135`。
 *   · `setBundleEnabled(name, enabled)` —— 官方 `lib/index.js:1670-1679`（→ `selectBundle` `:1979-2006`）：
 *     只读写 profile manifest 的 `dsh.profile.bundles`（**不卸载依赖**），返回 `stage: 'enable'`、
 *     `target: name`、`enabled` 的 `ChangeResult`；`application` 与其它变更同一口径（`overridden` 只可能来自
 *     行级的 `setPluginEnabled`，本端口用不到，故照其它方向如实落在「非成功即失败」那一支）。用户显式启停走的就是这一枚。
 *   · `waitForInstall(requestId)` —— 同文件 `:124`，返回**在途安装**的结果（`lib/index.js:1820` 读 `installs.get(id).result`），
 *     不取消；安装结束后该表项被删（`lib/index.js:1811`），此后返回 `null`（既不代表成功也不代表取消）。
 *   · `cancelInstall(requestId)` —— 同文件 `:130`，`applying` 阶段返回 `too-late`、没有该 id 返回 `not-running`、
 *     `installing` 阶段 abort 并**等** `control.result` 落定后返回 `cancelled`（`lib/index.js:1827-1838`）。
 *   · 进度与日志是**事件**（同文件 `:200-223` 的 `declare module '@deepseek-ai/cordis'`）：`plugin-manager/install-state`
 *     带 `{requestId, phase, attempt?}`，`plugin-manager/install-log` 带 `{requestId?, jobId, argv, cwd, stream, text, exitCode?}`。
 *
 * 三条纪律：
 *   1. **不猜、不降级**：官方服务不可用时端口**不接受**这半个面，调用点拿到稳定码后 fail-closed（503），
 *      绝不回落到 CLI/pnpm 第二条安装通道。
 *   2. **不接半个端口**：形状门禁要求五枚方法**全在**（缺一枚即与「服务缺席」同判），因为缺 `cancelInstall`
 *      时界面那枚取消键就会变回假按钮、缺 `setBundleEnabled` 时启停开关就会变回假开关——宁可整条安装面判不可用，
 *      也不给半个可取消/可启停的假象。
 *   3. **受控投影**：官方 `ChangeResult` 只投影稳定字段（`application`/`stage`/`error.code`/`warnings`…），
 *      pnpm 输出、`logPath`、`PackageResult.output` 与宿主路径一律不进本包的状态、库存或响应体。
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { PluginDistributionError } from './errors.js'

/** 官方 `ChangeResult.application` 的完整取值；**原样保留**，不由我们折叠成我们自己的语义。 */
export type ManagedPluginApplication = 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'

/** 官方 `ChangeResult.stage`。 */
export type ManagedPluginStage = 'install' | 'enable' | 'remove'

/** 官方安装/卸载结果的**受控投影**：只保留稳定字段，不放 pnpm 输出与宿主路径。 */
export interface ManagedPluginChangeResult {
  readonly target: string
  readonly changed: boolean
  readonly application: ManagedPluginApplication
  readonly stage?: ManagedPluginStage
  readonly enabled?: boolean
  readonly bundle?: string
  readonly warnings?: readonly string[]
  readonly failedAt?: 'registry' | 'spec-host'
  /** 官方在失败后读到的待批准构建脚本；原样保留，只进宿主日志。 */
  readonly pendingBuilds?: readonly string[]
  /** 官方依次问过的 registry；原样保留，只进宿主日志。 */
  readonly registries?: readonly (string | null)[]
  readonly error?: { readonly code?: string; readonly diagnostic?: string }
}

/** `installBundle` 的可选入参：是否顺带启用，以及**取消要用的** requestId。 */
export interface ManagedPluginInstallOptions {
  readonly enabled?: boolean
  readonly requestId?: string
}

/** 官方 `cancelInstall` 的闭集取值。 */
export type ManagedPluginCancellationStatus = 'cancelled' | 'too-late' | 'not-running'

/** 官方 `PluginInstallCancellation`。 */
export interface ManagedPluginCancellation {
  readonly status: ManagedPluginCancellationStatus
}

/** 官方 `PluginInstallProgress.phase`。 */
export type ManagedPluginInstallPhase = 'installing' | 'cancelling' | 'applying'

/** 官方 `plugin-manager/install-state` 投影（`attempt` 只在 `installing` 时出现）。 */
export interface ManagedPluginInstallProgress {
  readonly requestId: string
  readonly phase: ManagedPluginInstallPhase
  readonly attempt?: {
    readonly registry: string | null
    readonly index: number
    readonly total: number
  }
}

/** 官方 `plugin-manager/install-log` 投影：`text` 只进宿主日志，绝不进状态文件或响应体。 */
export interface ManagedPluginInstallLogChunk {
  readonly requestId?: string
  readonly jobId: string
  readonly stream: 'stdout' | 'stderr'
  readonly text: string
  readonly exitCode?: number | null
}

/** 受管插件端口：本包只认这五枚官方方法。 */
export interface ManagedPluginManagerPort {
  installBundle(spec: string, options?: ManagedPluginInstallOptions): Promise<ManagedPluginChangeResult>
  removeBundle(name: string): Promise<ManagedPluginChangeResult>
  /** 只改 profile 的 bundle 层：**不卸载依赖**（官方 `setBundleEnabled`）。 */
  setBundleEnabled(name: string, enabled: boolean): Promise<ManagedPluginChangeResult>
  waitForInstall(requestId: string): Promise<ManagedPluginChangeResult | null>
  cancelInstall(requestId: string): Promise<ManagedPluginCancellation>
}

/**
 * 官方 `PluginManager` 的结构面（不 import 官方包，保持 peer 边界）。
 *
 * `options` 与返回值的官方类型分别是 `InstallBundleOptions`（其 `requestId` 是 branded 的
 * `PluginInstallRequestId`）与 `ChangeResult`；这里一律按 `unknown` 收，投影在 `makeManagedPluginManagerPort`
 * 里逐字段做——品牌是**编译期**的，运行期就是一个字符串，故传普通 uuid 与官方语义逐字一致。
 */
export interface OfficialPluginManagerLike {
  installBundle(spec: string, options?: unknown): Promise<unknown>
  removeBundle(name: string): Promise<unknown>
  setBundleEnabled(name: string, enabled: boolean): Promise<unknown>
  waitForInstall(requestId: string): Promise<unknown>
  cancelInstall(requestId: string): Promise<unknown>
}

const APPLICATIONS: readonly ManagedPluginApplication[] =
  ['applied', 'restart-required', 'overridden', 'failed', 'cancelled']
const STAGES: readonly ManagedPluginStage[] = ['install', 'enable', 'remove']
const CANCELLATION_STATUSES: readonly ManagedPluginCancellationStatus[] = ['cancelled', 'too-late', 'not-running']

/** 官方 `ManagementError.code` 的形状门禁：只认小写 kebab，长度收窄（不把任意字符串原样带出）。 */
const OFFICIAL_CODE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
/** 官方诊断串的上界；与 `preset/install.ts` 同一口径。 */
const MAX_DIAGNOSTIC_LENGTH = 512

function readApplication(value: unknown): ManagedPluginApplication {
  return typeof value === 'string' && (APPLICATIONS as readonly string[]).includes(value)
    ? value as ManagedPluginApplication
    : 'failed'
}

/** `warnings` 与 `pendingBuilds` 同形：字符串数组，空数组与缺失同判。 */
function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length === 0 ? undefined : items
}

function readRegistries(value: unknown): readonly (string | null)[] | undefined {
  if (!Array.isArray(value)) return undefined
  const registries = value.filter((item): item is string | null => item === null || typeof item === 'string')
  return registries.length === 0 ? undefined : registries
}

function readOfficialError(value: unknown): ManagedPluginChangeResult['error'] {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const code = typeof row['code'] === 'string' && OFFICIAL_CODE_PATTERN.test(row['code']) ? row['code'] : undefined
  const diagnostic = typeof row['diagnostic'] === 'string' && row['diagnostic'].length <= MAX_DIAGNOSTIC_LENGTH
    ? row['diagnostic']
    : undefined
  if (code === undefined && diagnostic === undefined) return undefined
  return { ...(code === undefined ? {} : { code }), ...(diagnostic === undefined ? {} : { diagnostic }) }
}

/** 把一个官方 `ChangeResult` 逐字段投影成 `ManagedPluginChangeResult`（缺失字段不伪造）。 */
function projectChangeResult(target: string, value: unknown): ManagedPluginChangeResult {
  if (typeof value !== 'object' || value === null) {
    return { target, changed: false, application: 'failed' }
  }
  const row = value as Record<string, unknown>
  const stage = typeof row['stage'] === 'string' && (STAGES as readonly string[]).includes(row['stage'])
    ? row['stage'] as ManagedPluginStage
    : undefined
  const failedAt = row['failedAt'] === 'registry' || row['failedAt'] === 'spec-host' ? row['failedAt'] : undefined
  const error = readOfficialError(row['error'])
  const warnings = readStringArray(row['warnings'])
  const registries = readRegistries(row['registries'])
  const pendingBuilds = readStringArray(row['pendingBuilds'])
  return {
    target: typeof row['target'] === 'string' ? row['target'] : target,
    changed: row['changed'] === true,
    application: readApplication(row['application']),
    ...(stage === undefined ? {} : { stage }),
    ...(typeof row['enabled'] === 'boolean' ? { enabled: row['enabled'] } : {}),
    ...(typeof row['bundle'] === 'string' ? { bundle: row['bundle'] } : {}),
    ...(warnings === undefined ? {} : { warnings }),
    ...(failedAt === undefined ? {} : { failedAt }),
    ...(pendingBuilds === undefined ? {} : { pendingBuilds }),
    ...(registries === undefined ? {} : { registries }),
    ...(error === undefined ? {} : { error }),
  }
}

/**
 * 官方默认安装端口：**原样转发** + 受控投影；官方异常一律原样抛出（调用方当 `cause` 保留）。
 *
 * `cancelInstall` 的返回值只认那三个闭集值：拿到别的形状**不**谎报 `cancelled`（那会让界面以为
 * 取消成功了），而是按「没有在跑的安装」如实返回 `not-running` 并交由调用方留痕。
 */
export function makeManagedPluginManagerPort(manager: OfficialPluginManagerLike): ManagedPluginManagerPort {
  return {
    async installBundle(spec, options) {
      const result = await manager.installBundle(spec, options ?? {})
      return projectChangeResult(spec, result)
    },
    async removeBundle(name) {
      const result = await manager.removeBundle(name)
      return projectChangeResult(name, result)
    },
    async setBundleEnabled(name, enabled) {
      // 官方结果里的 `target` 一般就是 name；形状不合时 `projectChangeResult` 回落到我们交出去的 name，
      // 与 install/remove 同一口径（**不**谎报成功：只有 `changed:true` 才代表 profile 真的动了）。
      const result = await manager.setBundleEnabled(name, enabled)
      return projectChangeResult(name, result)
    },
    async waitForInstall(requestId) {
      const result = await manager.waitForInstall(requestId)
      return result === null || result === undefined ? null : projectChangeResult(requestId, result)
    },
    async cancelInstall(requestId) {
      const result = await manager.cancelInstall(requestId)
      const status = typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>)['status']
        : undefined
      return {
        status: typeof status === 'string' && (CANCELLATION_STATUSES as readonly string[]).includes(status)
          ? status as ManagedPluginCancellationStatus
          : 'not-running',
      }
    },
  }
}

/**
 * 官方插件面可达性：五枚方法**全在**才算可达（缺一枚即判不可达，见文件头纪律 2）。
 *
 * @param ctx - 宿主（或单测假）ctx；只读 `get`。
 * @returns 官方服务；形状不符即 `undefined`。
 */
export function managedPluginManagerFromContext(
  ctx: { get(name: string): unknown },
): OfficialPluginManagerLike | undefined {
  const manager = ctx.get('pluginManager')
  if (typeof manager !== 'object' || manager === null) return undefined
  const candidate = manager as Record<string, unknown>
  for (const method of ['installBundle', 'removeBundle', 'setBundleEnabled', 'waitForInstall', 'cancelInstall'] as const) {
    if (typeof candidate[method] !== 'function') return undefined
  }
  return manager as unknown as OfficialPluginManagerLike
}

/** 官方服务不可用时交给状态机的端口：每一次调用都用稳定码 fail-closed，绝不静默降级。 */
export function unavailableManagedPluginManagerPort(): ManagedPluginManagerPort {
  const refuse = (): never => {
    throw new PluginDistributionError(
      'ENT_PLUGIN_CLI_FAILED',
      'the official plugin manager is not available on this profile yet',
    )
  }
  return {
    installBundle: async () => refuse(),
    removeBundle: async () => refuse(),
    setBundleEnabled: async () => refuse(),
    waitForInstall: async () => refuse(),
    cancelInstall: async () => refuse(),
  }
}

/** 晚绑定持有者：端口**一次创建、长期不变**，内部「当前官方服务」随服务出现/撤下而变。 */
export interface LateBoundManagedPluginManagerPort {
  /** 交给 Service 的那一枚稳定端口；`wire()` 之前每次调用都 fail-closed。 */
  readonly port: ManagedPluginManagerPort
  /** 官方服务就绪：此后每次调用都实时解引用它。 */
  wire(manager: OfficialPluginManagerLike): void
  /** 官方服务被撤下：回到 fail-closed（在途安装由官方自己的 abort 收束）。 */
  unwire(): void
  /** 当前是否已绑定官方服务。 */
  wired(): boolean
}

/**
 * 造一个晚绑定持有者。
 *
 * 为什么需要它（与配方一键启用同一个真机缺陷）：官方 plugin-manager 与本 bundle 是同一棵 loader 树里
 * **并发 create** 的两个条目（`cordis-plugin-loader/src/config/group.ts` 的 `Group.update()` 用 `Promise.all`），
 * 而 `EnterprisePluginDistributionService` 是在 bundle 的 apply() 里**同步构造**的——那一刻
 * 一次性 `ctx.get('pluginManager')` 必然拿到 undefined。持有者让端口在**调用时**实时解引用，
 * 于是「服务稍后才 provide」不会把整条安装面判死。
 *
 * @returns 端口句柄；`wire()` 之前 `port` 的每一次调用都抛 `ENT_PLUGIN_CLI_FAILED`（fail-closed）。
 */
export function createLateBoundManagedPluginManagerPort(): LateBoundManagedPluginManagerPort {
  let current: ManagedPluginManagerPort | undefined
  const require = (): ManagedPluginManagerPort => {
    if (current === undefined) {
      throw new PluginDistributionError(
        'ENT_PLUGIN_CLI_FAILED',
        'the official plugin manager is not available on this profile yet',
      )
    }
    return current
  }
  return {
    port: {
      // 五枚都写成 `async`：服务缺席时得到的是**被拒的 promise** 而不是同步抛出，
      // 于是调用方（本 Service 与真机路由）无论 `await`/`.catch()` 都能拿到同一枚稳定码。
      installBundle: async (spec, options) => require().installBundle(spec, options),
      removeBundle: async name => require().removeBundle(name),
      setBundleEnabled: async (name, enabled) => require().setBundleEnabled(name, enabled),
      waitForInstall: async requestId => require().waitForInstall(requestId),
      cancelInstall: async requestId => require().cancelInstall(requestId),
    },
    wire: manager => { current = makeManagedPluginManagerPort(manager) },
    unwire: () => { current = undefined },
    wired: () => current !== undefined,
  }
}

/** 一条官方进度事件的形状门禁（事件来自官方包，这里只认自己会用的字段）。 */
export function readInstallProgress(value: unknown): ManagedPluginInstallProgress | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const requestId = row['requestId']
  const phase = row['phase']
  if (typeof requestId !== 'string' || requestId.length === 0) return undefined
  if (phase !== 'installing' && phase !== 'cancelling' && phase !== 'applying') return undefined
  const attemptRow = row['attempt']
  if (phase !== 'installing' || typeof attemptRow !== 'object' || attemptRow === null) return { requestId, phase }
  const attempt = attemptRow as Record<string, unknown>
  const registry = attempt['registry']
  const index = attempt['index']
  const total = attempt['total']
  if (!(registry === null || typeof registry === 'string')
    || typeof index !== 'number' || !Number.isSafeInteger(index)
    || typeof total !== 'number' || !Number.isSafeInteger(total)) {
    return { requestId, phase }
  }
  return { requestId, phase, attempt: { registry: registry as string | null, index, total } }
}

/** 一条官方日志块事件的形状门禁。 */
export function readInstallLogChunk(value: unknown): ManagedPluginInstallLogChunk | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const jobId = row['jobId']
  const stream = row['stream']
  const text = row['text']
  if (typeof jobId !== 'string' || jobId.length === 0) return undefined
  if (stream !== 'stdout' && stream !== 'stderr') return undefined
  if (typeof text !== 'string') return undefined
  const requestId = row['requestId']
  const exitCode = row['exitCode']
  return {
    ...(typeof requestId === 'string' && requestId.length > 0 ? { requestId } : {}),
    jobId,
    stream,
    text,
    ...(typeof exitCode === 'number' || exitCode === null ? { exitCode } : {}),
  }
}
