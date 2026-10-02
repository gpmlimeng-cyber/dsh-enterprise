/**
 * [INPUT]: 依赖 Cordis/Schemastery、Harness credentials/LLM/subprocess/inventory、官方 dsh-deepseek-account-platform、官方 settings 的 volatile Config 投影、platform-client 的地址写入诊断串与本地路由端口、plugin-distribution 的企业插件分发 Service 与其制品下载内核、官方运行时身份与企业业务模块
 * [OUTPUT]: 对外提供 Web/Desktop 共用 bundle apply、官方 settings 的 volatile Server/账户后台地址字段、默认关闭的插件验签开关、Host 凭据持久化、企业插件安装/卸载、**企业技能一键安装端口与已装技能只读正文端口**、条件 Session 同步注册，以及用 settings 自定义地址热重挂官方账户插件；安卓按 `browserHandoff: 'client'` 把登录浏览器交接给浏览器半（宿主进程没有可用的开源路径），地址不可持久化的每个判定点都写 warn/error 宿主日志
 * [POS]: bundle 的唯一 Host Loader 入口，组合平台认证、官方企业模型、账户后台地址、环境原生插件调和与企业技能落盘（`skill-install.ts`）；Session 同步仅在 sessionPolicy.enabled 时挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createRequire } from 'node:module'
import { release } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import * as AccountPlatform from '@deepseek-ai/dsh-deepseek-account-platform'
import type { Config as AccountPlatformConfig } from '@deepseek-ai/dsh-deepseek-account-platform'
import { APP_IDENTITY, type LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { registerEnterpriseGateway } from '@dshent/llm-gateway'
import {
  EnterprisePlatformError,
  EnterprisePlatformService,
  openSystemBrowser,
  resolveEnterpriseDshHome,
  settingsDiagnostics,
  settingsReference,
  thrownErrorDiagnostics,
  type WebServerRoutePort,
} from '@dshent/platform-client'
import {
  EnterprisePluginDistributionService,
  type DshPluginCommandPort,
  type PluginDistributionContext,
} from '@dshent/plugin-distribution'
import {
  createHostSessionLocalPort,
  tryRegisterHostSessionSync,
  type HostSessionSyncHandle,
  type HostSessionLocalPort,
  type SessionPersistencePort,
  type SessionStorePort,
  type SyncableSession,
} from '@dshent/session-sync'
import {
  DEFAULT_ACCOUNT_ORIGIN,
  createAccountOriginController,
  registerEnterpriseAccountRoutes,
  resolveAccountOrigins,
  type AccountOrigin,
  type AccountOriginController,
  type AccountOriginPort,
} from './account-origin.js'
import { registerEnterpriseFeedbackRoute } from './feedback-route.js'
import { registerEnterpriseHelpRoute } from './help-route.js'
import { registerEnterpriseUsageRoute } from './usage-route.js'
import { registerEnterpriseModelsStatusRoute } from './models-status.js'
import { createEnterpriseSkillInstall } from './skill-install.js'
import { registerEnterpriseSkillRoutes } from './skill-route.js'

declare module '@deepseek-ai/dsh-settings' {
  interface SettingsProvider {
    /**
     * 声明本插件实例的设置页策略。官方 0.1.7-rc.2 的 `SettingsForms.configure`
     * (`dsh-settings/lib/index.js:370`，`docs/subsystems/settings.md`) 取代了 0.1.5-rc.2 的
     * 命名空间注册面；本 workspace 的官方依赖基线仍是 0.1.5-rc.2，故在此补齐该成员。
     *
     * @param presentation - 自动页面策略；`auto` 默认 true。
     * @param owner - 策略归属的插件实例；缺省为调用方 fiber。
     * @returns 撤销策略的 disposer。
     */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  }
}

export const name = 'owndsh'
export const inject = ['webServer', 'credentials', 'settings', 'llm', 'subprocess', 'pluginInventory']

const VERIFIED_HARNESS_COMMITS: Readonly<Record<string, string>> = {
  '0.1.1-rc.2': 'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e',
  '0.1.2-rc.1': 'a66e4702047846cdaa10c66c9d3df3951f5ea70d',
  '0.1.5-rc.2': 'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  '0.1.7-rc.1': '46a7f68b0922371ce7144b668b90e377d8e799f4',
  '0.1.7-rc.2': '477b4f420553e8a52c2fbccc464d7561b239c443',
}
const HARNESS_VERSION = APP_IDENTITY.version
const { version: BUNDLE_VERSION } = createRequire(import.meta.url)('../package.json') as { version: string }

/**
 * 把一份 schema 标记为 volatile：官方 0.1.7-rc.2 的 schemastery 3.18.4
 * (`.volatile()` = `extra('volatile', true)`) 按该 meta 键把字段投影成配置引用，
 * 而本 workspace 的官方依赖基线 3.18.1 尚未声明 `Meta.volatile`，故按 meta 键写入。
 *
 * @param schema - 需要可热更新的字段 schema。
 * @returns 同一 schema，带 `volatile` meta。
 */
function volatile<T extends z>(schema: T): T {
  const extra: unknown = Reflect.get(schema, 'extra')
  if (typeof extra !== 'function') return schema
  return Reflect.apply(extra, schema, ['volatile', true])
}

export interface Config {
  /** 可选安装默认值；用户可在欢迎页写入 Harness 官方 settings。 */
  readonly baseUrl?: string
  /** 用户在官方 settings 中持久化的 Server 地址；解析结果为配置引用，组合层传字符串或引用。 */
  readonly serverUrl?: string
  /** 用户在官方 settings 中持久化的账户/推理后台地址；同样以 volatile 引用投影，留空回落企业默认。 */
  readonly platformOrigin: string
  readonly inferenceOrigin: string
  /** 默认关闭；开启后使用安装配置的公钥验证企业插件签名。 */
  readonly verifyPluginSignatures?: boolean
  /** 仅开启验签时读取的 Ed25519 SPKI PEM 或 DER Base64；bootstrap 无权替换。 */
  readonly trustedPluginPublicKey?: string
  readonly requestTimeoutMs: number
  readonly disposeTimeoutMs: number
  readonly profile: string
  readonly dshCommand: string
}

// 官方 0.1.7-rc.2 起，settings 只投影活动 profile entry 自身 Config 里的 volatile 字段，
// 命名空间就是该 entry 的 id；因此地址字段必须声明在这里，而不是另注册一个命名空间。
// 显式 `z<Config>` 注解会与 schemastery 3.18.4 的 volatile 输出类型（可含 Volatile<T>）冲突，
// 官方同名插件的做法是不注解、让 schema 自行推断，接口只用于 apply 的入参。
export const Config = z.object({
  baseUrl: z.string().default(''),
  serverUrl: volatile(z.string().default('')),
  platformOrigin: volatile(z.string().default(DEFAULT_ACCOUNT_ORIGIN))
    .description('账户授权与账户查询后台；留空或等默认即企业后台'),
  inferenceOrigin: volatile(z.string().default(DEFAULT_ACCOUNT_ORIGIN))
    .description('账户 token 允许附着的推理/文件后台；留空或等默认即企业后台'),
  verifyPluginSignatures: z.boolean().default(false),
  trustedPluginPublicKey: z.string().default(''),
  requestTimeoutMs: z.number().step(1).min(1).default(30_000),
  disposeTimeoutMs: z.number().step(1).min(1).default(3_000),
  profile: z.string().default('web'),
  dshCommand: z.string().default('dsh'),
})

interface EnterpriseHostContext extends Context {
  readonly webServer: WebServerRoutePort
  readonly credentials: CredentialProvider
  readonly llm: LlmRuntime
  readonly subprocess: PluginDistributionContext['subprocess']
  readonly pluginInventory: PluginDistributionContext['pluginInventory']
  readonly sessions?: SessionStorePort
  readonly sessionPersistence?: SessionPersistencePort
}

interface DesktopProfilesPort {
  readonly current: { readonly name: string }
}

interface DesktopPnpmPort {
  runPlugin(argv: readonly string[], invokingDir: string, signal?: AbortSignal): {
    readonly stdout: NodeJS.ReadableStream
    readonly stderr: NodeJS.ReadableStream
    readonly done: Promise<{ readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }>
  }
}

interface DesktopHostContext extends Context {
  readonly desktopPnpm: DesktopPnpmPort
}

interface DesktopActionsPort {
  requestRestart(): Promise<void>
}

function desktopPluginCommandPort(desktopPnpm: DesktopPnpmPort): DshPluginCommandPort {
  return {
    async run(argv, invokingDir, signal): Promise<void> {
      const operation = desktopPnpm.runPlugin(argv, invokingDir, signal)
      operation.stdout.resume()
      operation.stderr.resume()
      const outcome = await operation.done
      if (outcome.exitCode !== 0 || outcome.signal !== null) {
        throw new Error(`Desktop plugin command failed: exit=${String(outcome.exitCode)} signal=${String(outcome.signal)}`)
      }
    },
  }
}

/** base 行 `desktopPlatform` 表达式里的原生平台集合。 */
const DESKTOP_PLATFORM_NAMES = ['darwin', 'win32'] as const

/**
 * base 行 `desktopPlatform` 的同义表达式：只有桌面原生 profile 且运行在 macOS/Windows 时才声明原生身份。
 *
 * @param ctx - 组合根上下文；`profileContext` 是可选服务，只能经 `ctx.get` 读取。
 * @returns 原生平台名；其余情况返回 null，官方实现按 Web 客户端处理。
 */
function resolveDesktopPlatform(ctx: Context): 'darwin' | 'win32' | null {
  const profile = ctx.get('profileContext') as { readonly name?: string } | undefined
  if (profile?.name !== 'desktop') return null
  return DESKTOP_PLATFORM_NAMES.find(name => name === process.platform) ?? null
}

/**
 * 读取 owner Loader entry 的本地 id。官方 settings 的表单命名空间就是活动 profile entry 的 id，
 * 而 entry 由官方 Loader 增广到 fiber 上；bundle 不依赖 loader 包的类型，故按结构读取。
 *
 * @param ctx - 组合根上下文。
 * @returns owner entry id；非 Loader 组合下 undefined。
 */
function ownerEntryId(ctx: Context): string | undefined {
  const entry: unknown = Reflect.get(ctx.fiber, 'entry')
  if (typeof entry !== 'object' || entry === null) return undefined
  const options: unknown = Reflect.get(entry, 'options')
  if (typeof options !== 'object' || options === null) return undefined
  const id: unknown = Reflect.get(options, 'id')
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * 该 entry 当前的自动页面策略。官方 rc.2 的自动页面策略键是 owner fiber，
 * 官方 `configure` 对同一 fiber 只接受一次注册（重复即抛）；同一个 `owndsh` entry 上
 * platform-client 已为 volatile Server 地址声明过 `auto: false`，所以本包先读投影再决定是否补声明。
 *
 * `autoGenerate` 只存在于 0.1.7-rc.2 的 `SettingsForms.describe()`，而本 workspace 的官方依赖基线
 * 仍是 0.1.5-rc.2，故按结构读取。
 *
 * @param settings - 官方 `ctx.settings` 实例。
 * @param entryId - owner entry id。
 * @returns `true` 表示仍会自动生成页面，`false` 表示已有 `auto: false` 策略，
 *          `undefined` 表示该 entry 还没进入官方投影。
 */
function settingsAutoGenerate(settings: SettingsProvider, entryId: string): boolean | undefined {
  const descriptors = (settings as unknown as {
    describe(): readonly { readonly ns: unknown, readonly autoGenerate?: unknown }[]
  }).describe()
  for (const descriptor of descriptors) {
    if (String(descriptor.ns) === entryId) return descriptor.autoGenerate !== false
  }
  return undefined
}

/**
 * 用官方 `dsh-deepseek-account-platform` 的**同一实现**承载用户自定义的后台地址。
 *
 * 三条被官方实现约束的事实决定了这里的绑定方式：
 * 1. 该包 default export 一个 Service 类，Cordis `ctx.plugin` 不展开模块命名空间，必须取 `.default`。
 * 2. 它注册的 `deepseekAccount` 是全局唯一 Service 名，新实例必须先让旧实例卸载才能注册；
 *    因此"失败保留旧实例"由控制器用上一个地址重新挂载实现，而不是并存两个实例。
 * 3. `allowLoopbackHttp` 只解锁回环明文——正是本包校验器唯一放行的明文情形，非回环明文仍由上游拒绝。
 *
 * @param ctx - 承载官方插件与官方 settings 的上下文（bundle 组合根）。
 * @param settings - 已解析的地址读写端口（读自 volatile 引用，写经 `settings.update`）。
 * @returns 路由读写端口与热重挂生命周期。
 */
function createAccountOriginMount(
  ctx: Context,
  settings: Pick<AccountOriginPort, 'read' | 'write'>,
): AccountOriginController {
  return createAccountOriginController({
    read: settings.read,
    write: settings.write,
    mount: async (origins) => {
      const config: AccountPlatformConfig = {
        platformOrigin: origins.platformOrigin,
        inferenceOrigin: origins.inferenceOrigin,
        desktopPlatform: resolveDesktopPlatform(ctx),
        allowLoopbackHttp: true,
      }
      const fiber = ctx.plugin(AccountPlatform.default, config)
      await fiber
      return { dispose: () => fiber.dispose() }
    },
    onError: (message, error) => {
      ctx.logger.error(`owndsh: ${message}`, error)
    },
  })
}

/**
 * 把官方账户实现挂到用户自定义地址上，并把地址持久化进官方 settings。
 *
 * 官方 0.1.7-rc.2 的 settings 不再是「注册一个命名空间」：表单命名空间就是活动 profile entry 的 id，
 * 只投影该 entry 自身 Config 里的 volatile 字段。因此两个地址字段声明在本包 Config 中，
 * 读取走官方 volatile 引用，写入走 `settings.update(entryId, patch)`，并把该实例的自动页面策略关掉。
 * entry id 或 volatile 引用不可得时地址保持只读：写入以 `ENT_SETTINGS_UNAVAILABLE` 拒绝，
 * 与 platform-client 的 Server 地址语义一致，而不是误报平台不可用。
 * 四个「不可持久化」判定点（引用缺失 / configure 抛错 / 写入端口未装配 / `settings.update` 抛错）
 * 都在抛错前用 Host logger 留下 operation、地址、entryId、entry 可见性与原始 error。
 *
 * @param ctx - bundle 组合根上下文；settings 与事件都注册在它上面。
 * @param webServer - bundle 顶层注入的 `ctx.webServer` route port。
 * @param config - Loader 已解析的 entry Config（volatile 字段在运行期是配置引用）。
 * @returns 当前生效平台地址的读数；帮助中心路由用它派生 `${platformOrigin}/help/`（严格 allowlist）。
 */
function mountEnterpriseAccountOrigin(
  ctx: Context,
  webServer: WebServerRoutePort,
  config: Config,
): () => string | undefined {
  const platformOrigin = settingsReference<string>(config.platformOrigin)
  const inferenceOrigin = settingsReference<string>(config.inferenceOrigin)
  const entryId = ownerEntryId(ctx)
  const owner = ctx.fiber
  const read = (): AccountOrigin => resolveAccountOrigins({
    platformOrigin: platformOrigin?.get() ?? config.platformOrigin,
    inferenceOrigin: inferenceOrigin?.get() ?? config.inferenceOrigin,
  })
  let persist: ((patch: Partial<AccountOrigin>) => Promise<void>) | undefined
  if (entryId === undefined || platformOrigin === undefined || inferenceOrigin === undefined) {
    // 「不可持久化」判定：owner entry id 或两个 volatile 地址引用缺席；记清是哪一个。
    const missing = [
      ...(entryId === undefined ? ['entryId'] : []),
      ...(platformOrigin === undefined ? ['platformOrigin'] : []),
      ...(inferenceOrigin === undefined ? ['inferenceOrigin'] : []),
    ].join(',')
    ctx.logger.warn('owndsh: Harness settings do not expose the enterprise account origin on this profile'
      + ` [operation=mountAccountOrigin step=volatile-reference-missing missing=${missing}`
      + ` platformOrigin=${platformOrigin === undefined ? 'absent' : 'ready'}`
      + ` inferenceOrigin=${inferenceOrigin === undefined ? 'absent' : 'ready'}`
      + ` ${settingsDiagnostics(ctx, entryId)}]`)
  } else {
    ctx.inject(['settings'], settingsContext => {
      // 官方 Settings 生成这个页面没有意义：地址由企业配置向导经本地路由写。
      // `owndsh` entry id 的推导方式与 platform-client 完全相同（都读 ctx.fiber.entry.options.id），
      // 因此走到这里时它已为本 entry 声明过 `auto: false`；只有投影明确显示仍会自动生成时才补声明，
      // 否则重复注册会被官方 configure 如实抛错。entry 未进入投影时无页面可生成，同样不必声明。
      const autoGenerate = settingsAutoGenerate(settingsContext.settings, entryId)
      if (autoGenerate === true) {
        try {
          settingsContext.effect(() => settingsContext.settings.configure({ auto: false }, owner))
        } catch (error) {
          // 与 platform-client 共用同一个 owner fiber：这里抛错说明页面策略已被别处注册。
          ctx.logger.error('owndsh: settings.configure({auto:false}) failed for the account origin'
            + ` [operation=mountAccountOrigin step=configure-threw entryId=${entryId}`
            + ` ${settingsDiagnostics(ctx, entryId, settingsContext.settings)}]`
            + ` ${thrownErrorDiagnostics(error)}`, error)
          throw error
        }
      }
      persist = async patch => {
        try {
          await settingsContext.settings.update(entryId, patch)
        } catch (error) {
          ctx.logger.error('owndsh: settings.update rejected the account origin'
            + ` [operation=setAccountOrigin step=settings-update-threw entryId=${entryId}`
            + ` patch=${JSON.stringify(patch)}`
            + ` ${settingsDiagnostics(ctx, entryId, settingsContext.settings)}]`
            + ` ${thrownErrorDiagnostics(error)}`, error)
          throw error
        }
      }
      ctx.logger.warn('owndsh: account origin write port wired'
        + ` [operation=mountAccountOrigin step=wired entryId=${entryId} autoGenerate=${String(autoGenerate)}`
        + ` ${settingsDiagnostics(ctx, entryId, settingsContext.settings)}]`)
    })
  }
  const controller = createAccountOriginMount(ctx, {
    read,
    write: async (patch) => {
      const write = persist
      if (write === undefined) {
        // 「不可持久化」判定：`ctx.inject(['settings'])` 从未装配写入端口（服务缺席或装配期抛错）。
        ctx.logger.error('owndsh: refusing to save the account origin'
          + ` [operation=setAccountOrigin step=settings-write-port-missing entryId=${entryId ?? '(none)'}`
          + ` patch=${JSON.stringify(patch)} ${settingsDiagnostics(ctx, entryId)}]`)
        throw new EnterprisePlatformError(
          'ENT_SETTINGS_UNAVAILABLE',
          'Harness settings do not expose the enterprise account origin on this profile',
        )
      }
      await write(patch)
    },
  })
  ctx.effect(() => () => controller.dispose(), 'enterpriseAccountOrigin.dispose()')
  ctx.effect(() => registerEnterpriseAccountRoutes(webServer, controller), 'enterpriseAccountOrigin.routes')
  if (entryId !== undefined) {
    // 显式 POST 与外部改址会各自请求一次重挂；控制器按指纹幂等，串行化后只有第一次真正换实例。
    ctx.effect(() => ctx.on('settings/document-updated', namespace => {
      if (String(namespace) !== entryId) return
      void controller.apply(read()).catch((error: unknown) => {
        ctx.logger.error('owndsh: account origin hot remount failed', error)
      })
    }), 'enterpriseAccountOrigin.watch')
  }
  void controller.apply(read()).catch((error: unknown) => {
    ctx.logger.error('owndsh: initial official account platform mount failed', error)
  })
  return () => read().platformOrigin
}

/** 在 Harness 官方 Service 上挂载平台控制面，并把企业 profiles 并入已挂载的官方 dsh-llm-pi-ai。 */
export function apply(ctx: EnterpriseHostContext, config: Config): void {
  // 官方 0.1.7-rc.2 起 Cordis 强制 inject：访问未 inject 的服务属性会直接抛异常（`?.` 挡不住），
  // 因此会话相关服务一律经 ctx.get() 取可选实例，保持「缺失即跳过同步挂载」的原意。
  const sessions = ctx.get('sessions') as EnterpriseHostContext['sessions']
  const sessionPersistence = ctx.get('sessionPersistence') as EnterpriseHostContext['sessionPersistence']
  let pluginDistribution: EnterprisePluginDistributionService | undefined
  let sessionSyncHandle: HostSessionSyncHandle | null = null
  let platform: EnterprisePlatformService
  const sessionLocalPort: HostSessionLocalPort = createHostSessionLocalPort({
    platform: {
      status: () => platform.status(),
      bootstrap: () => platform.bootstrap(),
      request: (path, init) => platform.request(path, init),
      subscribe: listener => platform.subscribe(status => listener(status)),
    },
    getHandle: () => sessionSyncHandle,
    ...(sessions?.create === undefined ? {} : {
      createSession: {
        async create(id, options) {
          const session = await sessions!.create!(id, options)
          return { id: session.id }
        },
      },
    }),
  })
  /**
   * 技能安装端口：与 `sessionLocalPort` 同一手法，先拿住一个**晚绑定**的平台请求面，
   * 再把这两个端口交给 platform-client 的三条 `/skills/*` exact 路由。
   * 落盘根由 `resolveEnterpriseDshHome()` 决议（与官方 `dsh-home-paths` 同一套优先级），
   * 即官方 `skill-filesystem` 的 `user-dsh` 根 `<dshHome>/skills`；watcher 深度 1 直发现，装完无需重启。
   */
  const skillInstall = createEnterpriseSkillInstall({
    platform: { request: (input, init) => platform.request(input, init) },
    onError: (message, error) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  })
  platform = new EnterprisePlatformService(ctx, {
    ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
    serverUrl: settingsReference<string | undefined>(config.serverUrl),
    harnessVersion: HARNESS_VERSION,
    bundleVersion: BUNDLE_VERSION,
    requestTimeoutMs: config.requestTimeoutMs,
    disposeTimeoutMs: config.disposeTimeoutMs,
  }, {
    // 安卓宿主进程没有任何可用的开源路径（Termux/系统 am 都会被包名↔uid 校验拒绝），授权 URL
    // 改由浏览器半用壳原生桥打开；其余平台保持宿主直接打开。
    browserHandoff: process.platform === 'android' ? 'client' : 'host',
    pluginStatus: () => pluginDistribution?.status() ?? { assignmentRevision: 0, plugins: [] },
    skillStatus: () => skillInstall.status(),
    skillAction: (action, packageId) => skillInstall.action(action, packageId),
    // 只读正文端口：点技能行看详情时读**已装**技能的 SKILL.md（路径安全全在 skill-install.ts 里 fail-closed）。
    skillContent: (packageId, name) => skillInstall.content(packageId, name),
    sessionSync: sessionLocalPort,
    pluginAction: async (action, packageName, pluginVersionId) => {
      if (pluginDistribution === undefined) throw new Error('DSH Enterprise plugin distribution is unavailable')
      if (action === 'install') await pluginDistribution.install(packageName, pluginVersionId!)
      else await pluginDistribution.remove(packageName)
    },
    uninstallPlugin: async () => {
      if (pluginDistribution === undefined) throw new Error('DSH Enterprise plugin distribution is unavailable')
      await pluginDistribution.uninstall()
      const desktopActions = ctx.get('desktopActions') as DesktopActionsPort | undefined
      return desktopActions === undefined ? {} : {
        restart: () => {
          void desktopActions.requestRestart().catch(() => {
            ctx.logger.error('owndsh: desktop restart request failed after uninstall')
          })
        },
      }
    },
  })
  ctx.effect(() => registerEnterpriseGateway(ctx, {
    platform,
    harnessVersion: HARNESS_VERSION,
    bundleVersion: BUNDLE_VERSION,
  }), 'enterpriseGateway.registration')
  // 用量只读镜像：Access Token 只在 Host 内存，个人中心「我的用量」只能读这条同源路由，
  // 由 Host 以 GET 代取中心 usage/me；上游 401 投影 401、其余失败投影 503 并留 warn 日志。
  // 企业模型挂载状态（只读诊断）：Host 日志不落盘，断点状态从这里读。
  ctx.effect(() => registerEnterpriseModelsStatusRoute(ctx.webServer, ctx, platform, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`)
    ctx.logger.warn(error instanceof Error ? error.message : String(error))
  }), 'enterpriseModelsStatus.routes')
  ctx.effect(() => registerEnterpriseUsageRoute(ctx.webServer, platform, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseUsage.routes')
  // 企业技能目录：员工端「技能」tab 读这条同源路由（列表 + 详情），由 Host 代取中心 runtime 技能面；
  // 上游 401 投影 401、其余失败投影 503 并留 warn 日志。
  // 一键安装（下载 + SHA-256 校验 + 落盘到官方 `user-dsh` 技能根）由 `skill-install.ts` 承担，
  // 经 platform-client 的三条 `/skills/*` exact 动作路由暴露，落在 `<dshHome>/skills`，
  // 由官方 skill-filesystem 的 watcher 直接生效（无需重启）。
  ctx.effect(() => registerEnterpriseSkillRoutes(ctx.webServer, platform, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseSkills.routes')
  // 反馈提交透传：浏览器无令牌，由 Host 代取 Access Token 转交中心 multipart 提交；
  // 附件在本地就按中心同名口径限流（≤3 张 / 单张 ≤2 MiB / 位图魔数），
  // diagnostics 由 Host 采集（版本/OS/installationId/最近错误码）并覆盖浏览器提交的同名字段。
  ctx.effect(() => registerEnterpriseFeedbackRoute(ctx.webServer, platform, {
    hostVersion: HARNESS_VERSION,
    os: `${process.platform}-${release()}`,
    pluginVersion: BUNDLE_VERSION,
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseFeedback.routes')
  // 帮助中心：浏览器既拿不到也不该拿 URL，地址由 Host 按自己配置的平台地址 + 固定 /help/ 派生，
  // 再用 PKCE 登录那条系统浏览器通道打开（严格 allowlist = 没有可注入的输入）。
  const readPlatformOrigin = mountEnterpriseAccountOrigin(ctx, ctx.webServer, config)
  ctx.effect(() => registerEnterpriseHelpRoute(ctx.webServer, readPlatformOrigin, {
    open: (url, signal) => openSystemBrowser(url, signal),
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseHelp.routes')
  // Session 同步：仅 bootstrap sessionPolicy.enabled 时挂载；默认关闭零 Session API。
  sessionSyncHandle = tryRegisterHostSessionSync({
    dshHome: resolveEnterpriseDshHome(),
    platform: {
      status: () => platform.status(),
      bootstrap: () => platform.bootstrap(),
      request: (path, init) => platform.request(path, init),
      subscribe: listener => platform.subscribe(status => listener(status)),
    },
    runtime: {
      ...(sessions === undefined ? {} : { sessions }),
      ...(sessionPersistence === undefined ? {} : {
        sessionPersistence,
      }),
    },
    logger: {
      debug: message => ctx.logger.debug(`owndsh: ${message}`),
      info: message => ctx.logger.info(`owndsh: ${message}`),
      warn: message => ctx.logger.warn(`owndsh: ${message}`),
      error: message => ctx.logger.error(`owndsh: ${message}`),
    },
    onSessionEvent: listener => {
      // session/event 由官方 dsh-session 模块增广；bundle 不 import 该包，故本地窄类型订阅。
      const events = ctx as unknown as {
        on(
          name: 'session/event',
          listener: (session: SyncableSession) => void,
        ): () => boolean
      }
      const off = events.on('session/event', session => listener(session))
      return () => {
        off()
      }
    },
  })
  ctx.effect(() => () => {
    void (sessionSyncHandle as HostSessionSyncHandle | null)?.dispose()
  }, 'enterpriseSessionSync.dispose()')
  const mountPluginDistribution = (
    distributionContext: PluginDistributionContext,
    profile: string,
    commandPort?: DshPluginCommandPort,
  ): void => {
    pluginDistribution = new EnterprisePluginDistributionService(distributionContext, {
      verifyPluginSignatures: config.verifyPluginSignatures ?? false,
      ...(config.trustedPluginPublicKey === undefined ? {} : {
        trustedPluginPublicKey: config.trustedPluginPublicKey,
      }),
      ...(VERIFIED_HARNESS_COMMITS[HARNESS_VERSION] === undefined ? {} : {
        harnessCommit: VERIFIED_HARNESS_COMMITS[HARNESS_VERSION],
      }),
      bundleVersion: BUNDLE_VERSION,
      profile,
      dshCommand: config.dshCommand,
      subprocessGraceMs: config.disposeTimeoutMs,
    }, commandPort === undefined ? {} : { commandPort })
  }
  const desktopProfiles = ctx.get('desktopProfiles') as DesktopProfilesPort | undefined
  if (desktopProfiles === undefined) {
    mountPluginDistribution(ctx as PluginDistributionContext, config.profile)
  } else {
    ctx.inject(['desktopPnpm'], desktopContext => {
      const desktopHost = desktopContext as DesktopHostContext
      mountPluginDistribution(
        desktopHost as unknown as PluginDistributionContext,
        desktopProfiles.current.name,
        desktopPluginCommandPort(desktopHost.desktopPnpm),
      )
    })
  }
  // 目标1：官方 `deepseek-account` base 行已停用，账户后台由企业 bundle 用用户自定义地址挂载同一实现。
  // 挂载点已在上面拿到读数（readPlatformOrigin），帮助中心路由与它共用同一份「当前平台地址」。
}
