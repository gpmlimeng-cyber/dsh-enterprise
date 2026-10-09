/**
 * [INPUT]: 依赖 Cordis/Schemastery、Harness credentials/LLM/inventory、官方 dsh-deepseek-account-platform、官方 settings 的 volatile Config 投影、platform-client 的地址写入诊断串与本地路由端口、plugin-distribution 的企业插件分发 Service 与其制品下载内核、官方运行时身份与企业业务模块
 * [OUTPUT]: 对外提供 Web/Desktop 共用 bundle apply、官方 settings 的 volatile Server/账户后台地址字段、默认关闭的插件验签开关、Host 凭据持久化、**企业插件安装/卸载/取消（官方 `pluginManager` 安装面，经 `manager-wiring.ts` 延迟接线；不再有 `dsh plugin` 子进程、不再 inject `subprocess`）**、**企业技能一键安装端口、已装技能只读正文端口、通路一「本地上传」两端口（`skill-upload.ts`：multipart 闸门 + 独立自装清单 + 复用中心安装的加固落盘）与通路二「系统搜索」两端口（`skill-system.ts`：本机技能根盘点三态 + 纳入只登记不复制）、**通路三「在线搜索」两端口（`skill-online.ts`：三源 fan-out + codeload 整仓包 → 内存组 `.dshskill` → 复用加固落盘；公开源走**无凭据裸 fetch**、带令牌的平台面只用在本机记账）****、**企业配方一键启用端口（官方 inject 声明 + 延迟解析取 `pluginManager` 安装面 + 三个实时解引用的本机路由端口 + 既有运行时下载面取配方正文；服务时序上不可用则 fail-closed，等它出现再接线）**、条件 Session 同步注册、**连接器广场只读投影（口径 67：`connector-plaza.ts` + `esc-route.ts` 宿主内部许可表新增三条 MCP 路径）**、**资料库三面（本机路由 `/enterprise/api/v1/local/library/**` + 3 个 Host 工具 + `system-prompt/assemble` 注入；域与主体晚绑定，未登录/未开域 ⇒ 503 可重试）**，以及用 settings 自定义地址热重挂官方账户插件；安卓按 `browserHandoff: 'client'` 把登录浏览器交接给浏览器半（宿主进程没有可用的开源路径），地址不可持久化的每个判定点都写 warn/error 宿主日志
 * [POS]: bundle 的唯一 Host Loader 入口，组合平台认证、官方企业模型、账户后台地址、环境原生插件调和与企业技能落盘（`skill-install.ts` 的中心安装 + 两条通路共用的 `placeEnterpriseSkillArchive`，以及 `skill-upload.ts` 的本地上传/自装清单）**、企业配方一键启用（`preset/`核心 + `preset-source.ts` + `preset-service.ts` + `preset/wiring.ts` 的时序边界）与受管插件官方安装面（`manager-wiring.ts`，复用同一份 `deferOfficialServiceWiring`）、以及资料库纵深（`library/index.ts` 的 `createEnterpriseLibraryHost` + `mountEnterpriseLibraryFaces`）**；Session 同步仅在 sessionPolicy.enabled 时挂载
 *   ★**本刀（自装技能的卸载 / 打开所在文件夹）**：core 块再挂 `registerEnterpriseSelfInstalledActionRoutes` 两条
 *     **exact** sibling（`POST …/skills/self-installed/{uninstall,reveal}`，实现见新叶 `skill-self-installed.ts` +
 *     `skill-self-installed-route.ts`，**platform-client 零改动**）：正文关闭键集**恰好 `{name}`**（技能在本机的
 *     目录名 —— 界面「已安装」的真相来自官方发现面，那份冻结投影里**只有 `name`、没有我们的记录 id**；而 `skillId`
 *     的语义按来源各不相同，真正的落盘目录名在记录的 `names[]` 里），响应 `{data:{skills,removed}}`（两键，
 *     与 `GET /skills/self-installed` 逐字同形；内核那枚 `alreadyMissing` **只进 Host 日志**）。★归属判据：
 *     被**中心** `installed.json` 认领 ⇒ 404 拒；被**另一条**自装记录也认领 ⇒ 409 fail-closed；唯一独占才删，
 *     一包多技能只删那一个目录、记录保留其余名字；最后一个名字才整条原子移除。★路径只来自记录（客户端交来的
 *     永远只有名字），删除走 `deleteOwnedSkillDirectory` 那**唯一**一处；`reveal` 用系统文件管理器（argv、无 shell）。
 *   ★**口径 54（本刀）**：core 块再挂一条**只读**同源路由 `registerEnterpriseSkillDiscoveryRoute`
 *     （`GET /enterprise/api/v1/local/skills/discovered`，实现见新叶 `skill-discovery.ts`）—— 它是
 *     「已安装」的**真源**（宿主官方 `ctx.get('skills')` 的快照 = 本机运行时真正加载的那一份）。
 *     端口**每次调用现场解引用**官方服务（apply 那刻可能还没 provide），并要求它真的带一个函数形状的
 *     `snapshot`；服务缺席 / `snapshot()` 抛 / 回的东西读不懂 ⇒ 三条收敛成**明确失败码**
 *     `ENT_SKILL_DISCOVERY_UNAVAILABLE`（→503，落在唯一那张码→状态表的表尾 ⇒ platform-client 零改动），
 *     **绝不静默回空列表**；只回白名单字段，`path`/`resourceBase` 不出厂。
 *   ★★**口径 54 补丁（真机少报修复）**：同一端口再加一枚 `acquireScope()` —— 每次现场向官方
 *     `agentPresets.acquireScope()`（不传 id = 默认/当前 preset）取一枚引用计数租约，把它的 `key`
 *     作为 `snapshot({scope})` 的查看作用域，读完**必定释放**。官方 `skills` 是层叠注册表：
 *     "host rows and repository plugins land in the **global layer**, while a plugin mounted by an
 *      agent preset's standing composition lands in **that preset's layer**" ⇒ 不传 `scope` 只读得到
 *     全局层，preset 层整层漏掉（真机读数：3 条 vs 磁盘 7 枚，且这 7 枚**确实在会话技能目录里**）。
 *     作用域取不到 / 租约形状不过 / 释放失败 ⇒ 都收敛进上面那枚明确失败码（靠 `step` 在日志里分得开），
 *     **绝不回落成"不传 scope 的全局层读"**（那是同一条少报换个地方发生）。`cwd` 拿不到就不传。
 *   ★**口径 67 Phase C（连接器广场）的宿主半边**：core 块再挂一条 **exact 只读**路由
 *     `registerEnterpriseConnectorPlazaRoute`（`GET /enterprise/api/v1/local/connectors`，实现见新叶
 *     `connector-plaza.ts`），它的取数入口是**同一个 `escReadPort`** 的宿主内部读面
 *     （`readHostJson: path => readEnterpriseEscHostJson(escReadPort, path)`）——同一份 HTTP 客户端、
 *     同一枚票据、同一套判决，**不新增第二条 HTTP 通道**。
 *     · **D0**：`esc-route.ts` 的参数化模式表 5 → 8，新增 `/api/mcp/list/<id>`、`/api/mcp/deployed/list/<id>`、
 *       `/api/mcp/<id>` 三条**全部 `browserReadable: false`** ⇒ **浏览器可读表零新增**。理由：这三条命中是
 *       **凭据面**（真机每行带 `mcpConfig`/`deployedConfig`，`/api/mcp/134` 的 `mcpConfig` 实测就是可直接
 *       落地的客户端配置，可能夹带 URL 内嵌凭据/header/token），与 B0 那条"合规闸门"是**不同**的理由。
 *     · **D1**：广场由**宿主侧投影**（从零构造，不是删字段），出厂只有
 *       `{id,name,description?,icon?,installType,deployStatus,official?,toolCount?,space:{id,name}}`；
 *       逐空间取数（`/api/space/list` → 逐空间 `GET /api/mcp/list/<spaceId>`，**不引入 POST 读**），
 *       部分成功保留（失败空间 `ok:false`）、**全失败回本面唯一那枚码**
 *       `ENT_CONNECTOR_PLAZA_UNAVAILABLE`（→503，刻意不进 platform-client 那张码→状态表 ⇒ 该包零改动；
 *       但上游自带的受控码如 `ENT_AUTH_REQUIRED` **原样上抛**，不把"请先登录"折成"本机不可用"），
 *       **绝不静默回空列表**；空间数与连接器总数各一枚上限，超限 ⇒ 截断 + `complete:false` 原样出厂；
 *       判定点 `space-list-failed`/`space-mcp-failed`/`plaza-failed` 都经 `onError` 进 Host 日志。
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
import type { SettingsDescriptor } from '@deepseek-ai/dsh-settings'
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
  createLateBoundManagedPluginManagerPort,
  EnterprisePluginDistributionService,
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
import { registerEnterpriseEscReadRoute, readEnterpriseEscHostJson, type EnterpriseEscReadRoutePort } from './esc-route.js'
import { readEscMockSwitch } from './esc-mock.js'
import { registerEnterpriseConnectorPlazaRoute } from './connector-plaza.js'
import { createNuwaxSessionHolder } from './nuwax-auth.js'
import { registerEnterpriseNuwaxRoutes } from './nuwax-route.js'
import { createEnterpriseSkillInstall } from './skill-install.js'
import { installedSelfSkills, uploadSkillArchive } from './skill-upload.js'
import { adoptSystemSkill, discoverSystemSkills } from './skill-system.js'
import { installSkillFromResult, searchOnlineSkills } from './skill-online.js'
import { registerEnterpriseSkillRoutes } from './skill-route.js'
import { registerEnterpriseSkillDiscoveryRoute } from './skill-discovery.js'
import { discoverThirdPartySkills, installThirdPartySkill } from './skill-third-party.js'
import { registerEnterpriseThirdPartySkillRoutes } from './skill-third-party-route.js'
import { installPublishedSkill } from './skill-published.js'
import { registerEnterprisePublishedSkillRoute } from './skill-published-route.js'
import { revealSelfInstalledSkill, uninstallSelfInstalledSkill } from './skill-self-installed.js'
import { registerEnterpriseSelfInstalledActionRoutes } from './skill-self-installed-route.js'
import {
  createEnterpriseLibraryHost,
  mountEnterpriseLibraryFaces,
  type EnterpriseLibraryDomainFacilityPort,
  type EnterpriseLibraryEventPort,
  type EnterpriseLibraryToolRuntime,
} from './library/index.js'
import {
  createEnterprisePresetInstall,
  createLateBoundPresetService,
  deferEnterprisePresetWiring,
  type LateBoundPresetService,
  type PresetInstallPort,
} from './preset/index.js'
import { EnterprisePresetError } from './preset/errors.js'
import { deferEnterprisePluginManagerWiring } from './manager-wiring.js'
import { createEnterprisePresetRecipeSource } from './preset-source.js'
import { createEnterprisePresetService, type EnterprisePresetService } from './preset-service.js'

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

// [改名] 对外插件名从 `owndsh` 改为 `dshent`。它是 Cordis 插件名 = owner entry id = 官方 settings 命名空间。
// 兼容见 apply() 末尾的 `migrateLegacyEntrySettings()`：升级前 profile patch 与 settings 里仍挂着旧 entry `owndsh`
// 的 serverUrl/platformOrigin/inferenceOrigin，改名后命名空间随之变为 `dshent`，须先读旧命名空间搬过来（否则丢地址）。
export const name = 'dshent'
/** 改名前的插件名 / owner entry id；仅用于读取升级前落盘的 settings 与 patch 配置，**绝不**再作为写入目标。 */
const LEGACY_NAME = 'owndsh'
/** 三个随 owner entry id 走的 volatile 地址字段；迁移只搬这三项。 */
const ADDRESS_FIELDS = ['serverUrl', 'platformOrigin', 'inferenceOrigin'] as const
/** [组件拆分·真开关兜底] 两个组件开关的默认值（与 Config schema 默认逐字一致），供 migrate 补缺时引用。 */
const TOGGLE_DEFAULTS = { libraryEnabled: true, pluginsEnabled: true } as const
// 本刀之后 bundle **不再**声明 `subprocess`：安装/卸载/取消一律走官方 `pluginManager`，
// 全仓没有任何一条代码路径再起 `dsh plugin` 子进程（`subprocess` 因此不再是一条真依赖，
// 留着只会让本插件在缺 subprocess 的 profile 上白白不激活）。
export const inject = ['webServer', 'credentials', 'settings', 'llm', 'pluginInventory']

/**
 * 引擎版本 -> 官方发行 tag 指向的 commit。**只写查证到的事实，不写推测映射。**
 *
 * 事实来源：`github.com/deepseek-ai/deepseek-harness` 的 `git/ref/tags/dsh-v<version>`
 * 指向的 commit（轻量 tag，`object.type === 'commit'`），并以该 commit 的
 * `apps/cli/package.json.version` 交叉核对。用同一方法复核本表既有五条，五条逐字命中，
 * 故新增条目沿用同一证据口径：
 *   · `0.2.0-rc.2` -> `639ed015397290b3745d163aafe02ffee4aa3f84`
 *     （tag `dsh-v0.2.0-rc.2`；该 commit 的 `apps/cli/package.json` 声明 `version: 0.2.0-rc.2`；
 *      与本机已安装的 `node_modules/@deepseek-ai/dsh/package.json:2` 的 `0.2.0-rc.2` 一致）
 *
 * **诚实口径（不许悄悄映射）**：本表只回答"这个引擎版本对应哪个 commit"。
 * 若某版本不在表里，说明我们**无法确证**它对应哪个 commit —— 那不等于"不兼容"，因此
 * mountPluginDistribution 会省略 `harnessCommit`，由 `verification.ts`
 * 降级为**非阻断警告**（见 `verifyAssignmentMetadata` 的子句 4）。
 * 严禁把未知版本硬编码成某个"看起来像基线"的旧 commit 来假装通过白名单。
 */
const VERIFIED_HARNESS_COMMITS: Readonly<Record<string, string>> = {
  '0.1.1-rc.2': 'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e',
  '0.1.2-rc.1': 'a66e4702047846cdaa10c66c9d3df3951f5ea70d',
  '0.1.5-rc.2': 'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  '0.1.7-rc.1': '46a7f68b0922371ce7144b668b90e377d8e799f4',
  '0.1.7-rc.2': '477b4f420553e8a52c2fbccc464d7561b239c443',
  '0.2.0-rc.2': '639ed015397290b3745d163aafe02ffee4aa3f84',
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
  /** [组件拆分·真开关①] 资料库块（块③）默认开；关 ⇒ `mountLibrary` 不调用 ⇒ 资料库三面全撤。 */
  readonly libraryEnabled: boolean
  /** [组件拆分·真开关②] 受管插件块（块④）默认开；关 ⇒ `mountPlugins` 不调用 ⇒ 分发/安装/启停 fail-closed。 */
  readonly pluginsEnabled: boolean
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
  // [组件拆分·两个真开关] 默认全开（现有部署行为不变）；cordis.patch.yml 行内可显式覆盖。
  libraryEnabled: z.boolean().default(true)
    .description('资料库块（mountLibrary）是否挂载；关 ⇒ 资料库三面全撤'),
  pluginsEnabled: z.boolean().default(true)
    .description('受管插件块（mountPlugins）是否挂载；关 ⇒ 分发/安装/启停 fail-closed'),
  requestTimeoutMs: z.number().step(1).min(1).default(30_000),
  disposeTimeoutMs: z.number().step(1).min(1).default(3_000),
  profile: z.string().default('web'),
  dshCommand: z.string().default('dsh'),
})

interface EnterpriseHostContext extends Context {
  readonly webServer: WebServerRoutePort
  readonly credentials: CredentialProvider
  readonly llm: LlmRuntime
  readonly pluginInventory: PluginDistributionContext['pluginInventory']
  readonly sessions?: SessionStorePort
  readonly sessionPersistence?: SessionPersistencePort
}

interface DesktopActionsPort {
  requestRestart(): Promise<void>
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

/**
 * [改名迁移] 把升级前挂在旧命名空间 `owndsh` 下的三个 volatile 地址字段搬进新命名空间 `dshent`。
 *
 * 官方 settings 的命名空间 == 活动 profile owner entry 的 id。本插件 owner entry 从 `owndsh` 改名为
 * `dshent` 后，用户此前在设置里填的 `serverUrl`/`platformOrigin`/`inferenceOrigin` 仍按旧 id 存在文档里，
 * 新命名空间读不到它们 —— 不搬则升级即丢 Server 地址，用户被迫重新填。
 *
 * 语义：**仅当新命名空间该字段为空/缺省、且旧命名空间该字段有值时**才搬，绝不覆盖改名后新写入的值；
 * 三个字段各自独立判断。旧命名空间不存在（全新安装）时直接返回，无副作用。
 *
 * @param settings - 官方 settings 读写端（`describe()` 读、`update(ns, patch)` 写）。
 * @param logger - Host 日志；搬运与否、结果都留一行可观测记录。
 * @returns 搬运操作的 promise；调用方在 `ctx.inject(['settings'])` 的 effect 里 await。
 */
function migrateLegacyEntrySettings(
  settings: Pick<SettingsProvider, 'describe' | 'update'>,
  logger: EnterpriseHostContext['logger'],
): void {
  let descriptors: SettingsDescriptor[]
  try {
    descriptors = settings.describe()
  } catch (error) {
    logger.warn(`dshent: rename settings migration skipped; describe() failed [operation=migrateSettings step=describe-threw]`, error)
    return
  }
  const legacy = descriptors.find(descriptor => String(descriptor.ns) === LEGACY_NAME)
  const current = descriptors.find(descriptor => String(descriptor.ns) === name)
  // 旧命名空间缺席 = 全新安装（从未以旧名写过地址），无可搬；新命名空间缺席 = 本 entry 还没进投影，同样不搬。
  if (legacy === undefined || current === undefined) return
  const legacyValue = (legacy.value ?? {}) as Record<string, unknown>
  const currentValue = (current.value ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const field of ADDRESS_FIELDS) {
    const from = legacyValue[field]
    const to = currentValue[field]
    const toEmpty = to === undefined || to === null || to === ''
    if (toEmpty && typeof from === 'string' && from !== '') patch[field] = from
  }
  // [组件拆分·真开关兜底] 两个开关（libraryEnabled/pluginsEnabled）的**唯一真源是 profile 主 patch 的
  // dshent 行**——但主 patch 属于 profile 用户层、**不在 dsh-enterprise 仓库内**（改它进不了 commit）。为避免
  // 漏写时开关缺席，这里在**当前 entry（`dshent`）的 config 缺该键时**补默认 true：只补缺、绝不覆盖用户已
  // 显式写的值（写 false 仍是关）。故两开关的最终来源 = schema 默认（加载期）+ 本兜底（启动期）+ 主 patch
  // （可覆盖），三重一致。注意：dump-config 在 apply() 之前退出、不走到这里，本兜底对 dump 树不可见。
  for (const [key, fallback] of Object.entries(TOGGLE_DEFAULTS)) {
    const existing = currentValue[key]
    if (existing === undefined || existing === null) patch[key] = fallback
  }
  if (Object.keys(patch).length === 0) {
    logger.debug(`dshent: no legacy address fields to migrate [operation=migrateSettings step=no-op ns=${LEGACY_NAME}→${name}]`)
    return
  }
  void settings.update(name, patch).then(
    () => {
      logger.warn(`dshent: migrated legacy settings namespace ${LEGACY_NAME} → ${name}`
        + ` [operation=migrateSettings step=migrated fields=${Object.keys(patch).join(',')} status=success]`)
    },
    (error: unknown) => {
      // 搬运失败不是致命错：地址仍在旧命名空间里，下次启动重试；但要留够诊断信息。
      logger.warn(`dshent: legacy settings migration failed; addresses remain under ${LEGACY_NAME}`
        + ` [operation=migrateSettings step=update-rejected ns=${name} fields=${Object.keys(patch).join(',')} status=failed]`, error)
    },
  )
}

/** 在 Harness 官方 Service 上挂载平台控制面，并把企业 profiles 并入已挂载的官方 dsh-llm-pi-ai。 */
/**
 * [组件拆分·块③] 资料库宿主接线（存储域 + 本机路由 + Host 工具 + system-prompt 注入）。
 *
 * 从 `apply()` 原 716–756 段**纯移动**而来，行为一字未改：它只**读** `platform`（主体判定）、
 * 用 `ctx.get()` 取可选的 `storageDomain`/`tools`、注册两条 `ctx.effect`，区域①从不引用
 * `libraryHost`，故是四个块里**最独立**的一块——最适合作为拆分的首刀，先证纯移动可绿、
 * 再在其上挂 `libraryEnabled` 开关（见 Config）。拆出后由 `apply()` 按开关调用。
 *
 * @param ctx - 组合根上下文。
 * @param platform - core 块构造的平台服务（主体＝当前企业登录用户，只读其 status）。
 */
function mountLibrary(ctx: EnterpriseHostContext, platform: EnterprisePlatformService): void {
  /**
   * 资料库（方案 §5.1 的 P0 竖切）宿主接线：**存储域 + 本机路由 + Host 工具 + system-prompt 注入**。
   *
   * 三处刻意选择（都在 `library/host.ts` 的文件头写明了理由）：
   * · 域与主体**晚绑定**：`open` 是异步的、企业登录态可能晚到，故三个面先挂上，
   *   每次调用实时解引用"当前门面"；未就绪 ⇒ 503 `ENT_LIBRARY_UNAVAILABLE`（可重试），不是 404、不是空列表。
   * · 主体＝**当前企业登录用户**（`platform.status().user.id`）：未登录就没有可归属的主体 ⇒ 门面缺席。
   *   这就是方案 §2.3 那条"不新造 IdentityService"的落法（唯一真源仍是 platform-client 的登录态）。
   * · `storageDomain`/`tools` 都用 `ctx.get()` 而不进 `inject` 数组：它们是**可选**面（缺它们只让资料库
   *   这一角不可用，不该让整个 bundle 不激活）。缺 `events` 时注入不挂——三条面互相独立。
   */
  const libraryHost = createEnterpriseLibraryHost({
    facility: ctx.get('storageDomain') as EnterpriseLibraryDomainFacilityPort | undefined,
    tools: ctx.get('tools') as EnterpriseLibraryToolRuntime | undefined,
    events: ctx as unknown as EnterpriseLibraryEventPort,
    readSubject: () => {
      const user = platform.status().user
      return user === undefined || user.id.length === 0
        ? undefined
        : { scope: 'personal', ownerId: user.id }
    },
    log: (level, message, error) => {
      if (level === 'info') ctx.logger.info(message)
      else ctx.logger.warn(message, error)
    },
  })
  ctx.effect(() => mountEnterpriseLibraryFaces(libraryHost, {
    webServer: ctx.webServer,
    tools: ctx.get('tools') as EnterpriseLibraryToolRuntime | undefined,
    events: ctx as unknown as EnterpriseLibraryEventPort,
  }), 'enterpriseLibrary.faces')
  ctx.effect(() => {
    void libraryHost.start().catch((error: unknown) => {
      ctx.logger.warn('owndsh: library domain open failed', error)
    })
    return () => {
      void libraryHost.dispose().catch((error: unknown) => {
        ctx.logger.warn('owndsh: library domain dispose failed', error)
      })
    }
  }, 'enterpriseLibrary.lifecycle')
}

/**
 * [组件拆分·块②] Session 同步挂载（仅 bootstrap sessionPolicy.enabled 时真挂；默认关闭零 Session API）。
 *
 * 从 `apply()` 原 733–770 段**纯移动**而来，行为一字未改：只**读** `platform`、`sessions`、
 * `sessionPersistence`，注册一条 dispose `ctx.effect`。`sessionSyncHandle` 是 block ① 里
 * `sessionLocalPort` 的 `getHandle` 闭包所读的那个**外层变量**，故本函数把新建的 handle **返回**，
 * 由 `apply()` 回写同一变量（保持闭包可见，不改晚绑定语义）。
 *
 * @param ctx - 组合根上下文。
 * @param platform - core 块构造的平台服务（同步面按调用时实时解引用它）。
 * @param sessions - 可选会话服务（`ctx.get` 取，缺失即不同步建会话）。
 * @param sessionPersistence - 可选会话持久化服务。
 * @returns 新建的 session 同步 handle（供 apply 回写到 sessionSyncHandle）。
 */
function mountSession(
  ctx: EnterpriseHostContext,
  platform: EnterprisePlatformService,
  sessions: EnterpriseHostContext['sessions'],
  sessionPersistence: EnterpriseHostContext['sessionPersistence'],
): HostSessionSyncHandle | null {
  const handle = tryRegisterHostSessionSync({
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
    void (handle as HostSessionSyncHandle | null)?.dispose()
  }, 'enterpriseSessionSync.dispose()')
  return handle
}

/**
 * [组件拆分·块④] 受管插件分发接线（分发服务 + 官方 pluginManager 延迟接线 + 一次挂载）。
 *
 * 从 `apply()` 原 799–832 段**纯移动**而来，行为一字未改：只用 `config`、`pluginManagerHolder`
 * 与**回写** `pluginDistribution`。`pluginDistribution` 是 block ① 各插件路由（pluginStatus/
 * pluginAction/pluginCancel/pluginSetEnabled/uninstallPlugin）闭包所读的外层变量，故本函数经
 * `setDistribution` 回调把它交还 `apply()` 写入同一变量（不改晚绑定语义）。拆出后由 `apply()`
 * 按 `pluginsEnabled` 开关调用：关 ⇒ 不建分发服务、不接 pluginManager ⇒ 四个插件路由 fail-closed。
 *
 * @param ctx - 组合根上下文（同时是 `PluginDistributionContext`）。
 * @param config - Host 配置（验签公钥、超时、harness/bundle 版本来源）。
 * @param deps.pluginManagerHolder - 官方安装面的晚绑定持有者（一次创建、状态随服务变）。
 * @param deps.setDistribution - 把新建的分发服务回写到 apply 外层 `pluginDistribution` 变量。
 */
function mountPlugins(
  ctx: EnterpriseHostContext,
  config: Config,
  deps: {
    readonly pluginManagerHolder: ReturnType<typeof createLateBoundManagedPluginManagerPort>
    readonly setDistribution: (service: EnterprisePluginDistributionService) => void
  },
): void {
  const { pluginManagerHolder, setDistribution } = deps
  const mountPluginDistribution = (
    distributionContext: PluginDistributionContext,
  ): void => {
    setDistribution(new EnterprisePluginDistributionService(distributionContext, {
      verifyPluginSignatures: config.verifyPluginSignatures ?? false,
      ...(config.trustedPluginPublicKey === undefined ? {} : {
        trustedPluginPublicKey: config.trustedPluginPublicKey,
      }),
      // 表里没有本机引擎版本时**故意不写** harnessCommit：这是"我们无法确证 commit"的诚实表达，
      // 不是"不兼容"。verification.ts 子句 4 据此降级为非阻断警告（不认识引擎版本不拦安装）；
      // 绝不在这里塞一个旧 commit 去蒙混白名单。补齐真实映射见 VERIFIED_HARNESS_COMMITS 的注释。
      ...(VERIFIED_HARNESS_COMMITS[HARNESS_VERSION] === undefined ? {} : {
        harnessCommit: VERIFIED_HARNESS_COMMITS[HARNESS_VERSION],
      }),
      bundleVersion: BUNDLE_VERSION,
    }, {
      // 官方安装面（`pluginManager`）：**调用时**实时解引用，服务稍后就绪也进得了安装路径
      // （与配方那三端口同一个「第二个冻结点」的解药；一次性快照会让它永远缺席）。
      pluginManager: pluginManagerHolder.port,
    }))
  }
  // 受管插件安装/卸载/取消也走官方服务面：与配方一键启用**同一套**延迟接线
  // （`deferOfficialServiceWiring`），等同一对官方服务。apply() 那一刻服务还没 provide 时
  // 端口不解散——`pluginManagerHolder.port` 每次调用都实时解引用，未就绪即 fail-closed。
  deferEnterprisePluginManagerWiring(ctx, {
    onWired: manager => { pluginManagerHolder.wire(manager) },
    onUnwired: () => { pluginManagerHolder.unwire() },
    log: (level, message, error) => {
      if (level === 'error') ctx.logger.error(message, error)
      else if (level === 'info') ctx.logger.info(message)
      else ctx.logger.warn(message)
    },
  })
  mountPluginDistribution(ctx as PluginDistributionContext)
}

export function apply(ctx: EnterpriseHostContext, config: Config): void {
  // 官方 0.1.7-rc.2 起 Cordis 强制 inject：访问未 inject 的服务属性会直接抛异常（`?.` 挡不住），
  // 因此会话相关服务一律经 ctx.get() 取可选实例，保持「缺失即跳过同步挂载」的原意。
  const sessions = ctx.get('sessions') as EnterpriseHostContext['sessions']
  const sessionPersistence = ctx.get('sessionPersistence') as EnterpriseHostContext['sessionPersistence']
  /**
   * 官方安装面的**晚绑定持有者**：`mountPluginDistribution` 在本函数末尾同步构造分发服务，
   * 而官方 plugin-manager 要到它自己的条目被 loader create 之后才 provide，故端口必须一次创建、
   * 内部状态随服务出现/撤下而变（与 `presetHolder` 同一个「第二个冻结点」的解药）。
   */
  const pluginManagerHolder = createLateBoundManagedPluginManagerPort()
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
  const skillInstallOptions = {
    platform: { request: (input: string, init?: RequestInit) => platform.request(input, init) },
    onError: (message: string, error: unknown) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  }
  const skillInstall = createEnterpriseSkillInstall(skillInstallOptions)
  /**
   * 通路三「在线搜索」的宿主接线（§B.2/§C）：**独立于** `skillInstallOptions` 的第二份依赖。
   *
   * ★为什么必须分开：上面那份的 `platform` 是**带 Bearer 的同源平台面**（`platform-service.ts:709-733`），
   * 只能打企业服务器；而这条通路要打的是三个**公开**聚合源与 `codeload.github.com`。把令牌发到第三方
   * 是绝不能发生的事，所以这里只给一个 `fetch` 形状的**无凭据**取数面 —— 模块的端口形状里根本没有
   * 平台面这个字段（落盘步骤需要的那种形状由 `skill-online.ts` 自己用一个毒化桩满足）。
   * 白名单、手动重定向、15s 超时、体量上限与「装不出来就丢」全在 `skill-online.ts` 里判。
   */
  const onlineSkillOptions = {
    fetch: (input: string, init?: RequestInit) => fetch(input, init),
    onError: (message: string, error: unknown) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  }
  /**
   * 配方一键启用（D1=A）的宿主接线：**延迟解析 + 晚绑定 + fail-closed**。
   *
   * · 安装面唯一来源是官方服务 `pluginManager`（spike §4 实证：普通 Host 插件即可达，
   *   服务面**零弹层**）。但它与本 bundle 是同一棵 loader 树里**并发 create** 的两个条目
   *   （`cordis-plugin-loader/src/config/group.ts` 的 `Group.update()` 用 `Promise.all`），
   *   而我们的 `inject`（本文件第 82 行）里没有 `pluginManager` —— apply() 会跑在服务
   *   provide **之前**。所以这里有两处**不能再「定生死」**的地方，缺一不可：
   *   ① 取服务：走官方 inject 口径 `deferEnterprisePresetWiring`，服务出现后回调被重新装载；
   *   ② 交端口：下面那三个 `presetEnable/presetDisable/presetStatus` **无条件**交给
   *      `EnterprisePlatformService`，它们每次调用都实时解引用 `presetHolder`——
   *      若仍在 `{...}` 展开里一次性快照，服务就绪也进不了路由（第二个冻结点）。
   * · 就绪与未就绪由 `requirePresetService()` 判：未就绪抛 `ENT_PRESET_INSTALL_FAILED`
   *   （唯一码→状态表给 503，可重试）；**绝不**猜、**绝不**降级成 CLI/pnpm 第二条安装通道。
   *   本进程根本不在 profile 里（`profileContext.dir` 缺席，官方 `installBundle` 没有
   *   `node_modules` 落点）时同样停在这个等待态，并由 `deferEnterprisePresetWiring` 留
   *   `step=deferred / step=wired / step=unavailable` 三条判定点日志说明缺哪一个、何时就绪。
   * · 配方正文只从**既有**运行时授权下载 operation 取（`preset-source.ts` 头部列了契约与实现出处），
   *   与技能安装共用同一个下载内核，绝不新造第二个下载通道。
   * · 授权门（三态 + 集合指纹）由核心承担；本层只把核心的**结果对象**翻成稳定错误码抛出，
   *   让 platform-client 那张唯一的码→状态映射表给出 HTTP 状态。
   */
  let presetHolder: LateBoundPresetService<EnterprisePresetService> | undefined
  const wirePreset = (port: PresetInstallPort, profileDir: string): void => {
    // 持有者**一次创建、长期不变**；只有它内部的"当前服务"随官方服务出现/撤下而变。
    presetHolder ??= createLateBoundPresetService<EnterprisePresetService>({
      create: (wiredPort, wiredProfileDir) => createEnterprisePresetService({
        // 两处都晚绑定：`platform` 在本行之后才被赋值，闭包只在**调用时**解引用它。
        install: createEnterprisePresetInstall({
          port: wiredPort,
          profileDir: wiredProfileDir,
          onError: (message, error) => {
            ctx.logger.warn(`owndsh: ${message}`, error)
          },
        }),
        source: createEnterprisePresetRecipeSource({
          platform: {
            getPreset: (presetPackageId, signal) => platform.getPreset(presetPackageId, signal),
            request: (input, init) => platform.request(input, init),
          },
          onError: (message, error) => {
            ctx.logger.warn(`owndsh: ${message}`, error)
          },
        }),
        onError: (message, error) => {
          ctx.logger.warn(`owndsh: ${message}`, error)
        },
      }),
    })
    presetHolder.wire(port, profileDir)
  }
  deferEnterprisePresetWiring(ctx, {
    onWired: wirePreset,
    onUnwired: () => {
      // 服务被官方撤下：新端口立刻回到 fail-closed 的等待态（已装配方仍在盘上，status 不因此丢）。
      presetHolder?.unwire()
    },
    log: (level, message, error) => {
      // 「服务就绪」的可见判据：apply 那刻的真实可见性（step=deferred）、端口交给路由的那一刻
      // （step=wired / pluginManager=ready profileDir=ready）、以及服务缺席（step=unavailable）都在这里。
      if (level === 'error') ctx.logger.error(message, error)
      else if (level === 'info') ctx.logger.info(message)
      else ctx.logger.warn(message)
    },
  })
  /** 三条配方路由的实时解引用：仍未就绪就 fail-closed（稳定码 → 唯一那张表给 503，绝不静默降级）。 */
  const requirePresetService = (): EnterprisePresetService => {
    const service = presetHolder?.service()
    if (service === undefined) {
      throw new EnterprisePresetError(
        'ENT_PRESET_INSTALL_FAILED',
        'the official plugin manager is not available on this profile yet',
      )
    }
    return service
  }
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
    // 通路一「本地上传」（§B.1 方案甲）：正文由本机路由有界读入（50 MiB 独立配额，绝不动 JSON 的 256 KiB），
    // 这里只把「正文 + boundary」交给 bundle；分帧解析、闸门与落盘全在 skill-upload.ts（与中心安装同一套加固落盘）。
    skillUpload: (body, boundary) => uploadSkillArchive(skillInstallOptions, body, boundary),
    // 本机自装清单（§E.2③ 的独立状态文件）：与上面那条同源，只读、不碰中心口径的 installed.json。
    skillSelfInstalled: () => installedSelfSkills(skillInstallOptions),
    // 通路二「系统搜索」（盘点 + 纳入）：两个端口都**无条件**接线（判据全在调用时现场算，没有可缓存的状态）。
    // 盘点只读本机技能根（`<dshHome>/skills` + 可注入的额外只读根，v1 默认空）；纳入**只登记不复制**，
    // 落进的是与上一条同一份自装清单（`skill-system.ts` 复用 `upsertSelfInstalledRecord`，七键 + 0600 原子写）。
    skillSystemSearch: () => discoverSystemSkills(skillInstallOptions),
    skillAdopt: path => adoptSystemSkill(skillInstallOptions, path),
    // 通路三「在线搜索」（三源 fan-out + 从结果安装）：两个端口**无条件**接线。
    // ★公开源走的是**无凭据裸 fetch**，绝不能用上面那个带令牌的平台面 —— `platform-service.ts:709-733`
    // 的 `request()` 是同源 + 注入 Authorization 的，拿它打第三方等于把企业令牌发给公网（而且会当场被
    // 同源检查拒掉）。所以这里另开一个 `fetch` 形状的取数面；`skill-online.ts` 的端口形状里根本没有
    // 平台面，落盘用的那个 `platform` 是毒化桩（真被调用就抛错）。
    skillOnlineSearch: query => searchOnlineSkills(onlineSkillOptions, query),
    skillInstallFromResult: source => installSkillFromResult(onlineSkillOptions, source),
    // 配方一键启用（三条本机路由：`/presets/<id>/{enable,disable,status}`）。三个端口**无条件**接线：
    // 它们在**调用时**才解引用 `presetHolder`，因此官方 pluginManager 稍后就绪时端口会真的进到路由。
    // 仍未就绪则由 `requirePresetService()` fail-closed：抛 `ENT_PRESET_INSTALL_FAILED`（唯一那张
    // 码→状态表给 503，语义正是「本机/上游暂不可用，可重试」），**不是**静默不接线、更不是去猜第二个安装通道。
    presetEnable: (presetPackageId: string, confirmFingerprint?: string) =>
      requirePresetService().enable(presetPackageId, confirmFingerprint),
    presetDisable: (declarationId: string) => requirePresetService().disable(declarationId),
    presetStatus: (presetPackageId: string) => requirePresetService().status(presetPackageId),
    sessionSync: sessionLocalPort,
    pluginAction: async (action, packageName, pluginVersionId) => {
      if (pluginDistribution === undefined) throw new Error('DSH Enterprise plugin distribution is unavailable')
      if (action === 'install') await pluginDistribution.install(packageName, pluginVersionId!)
      else await pluginDistribution.remove(packageName)
    },
    // 取消是**真的**：`cancel(packageName)` 直接打官方 `pluginManager.cancelInstall(requestId)`，
    // 官方会 abort 掉那一跑 pnpm 并等文件回滚，在途的 install 随即以「取消」收束。
    // 未就绪的那一次（服务还没 provide）由 `pluginDistribution` 内部的 fail-closed 端口如实拒。
    pluginCancel: async (packageName: string) => {
      if (pluginDistribution === undefined) throw new Error('DSH Enterprise plugin distribution is unavailable')
      return await pluginDistribution.cancel(packageName)
    },
    // 启用 / 停用：与 `pluginAction` / `pluginCancel` 同一手法——组合层**无条件**接线，
    // 端口在**调用时**才解引用分发服务；服务没接线时这里如实抛，真正打官方的那一步在
    // `setEnabled` 里（`pluginManager.setBundleEnabled`，只改 profile 的 bundle 层，不卸载依赖）。
    pluginSetEnabled: async (packageName: string, enabled: boolean) => {
      if (pluginDistribution === undefined) throw new Error('DSH Enterprise plugin distribution is unavailable')
      return await pluginDistribution.setEnabled(packageName, enabled)
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
  }, {
    // 本机文件家族（详情子页面的文件树 + 单文件预览）：端口就是同一个 `skillInstall`，
    // 路径门禁/落点等式/文本读取全在 `skill-install.ts` 那一份实现里，路由只做分派。
    files: packageId => skillInstall.files(packageId),
    file: (packageId, path) => skillInstall.file(packageId, path),
  }), 'enterpriseSkills.routes')
  // 本机**官方发现面**只读镜像（口径 54）：员工端「已安装」的计数与子页改读这条
  // `GET /enterprise/api/v1/local/skills/discovered` —— 它答的是"**本机 DSH 真的装着什么**"，
  // 而不是"我们自己那两份记录里写了什么"（真机取证：磁盘 7 枚 vs 企业记录 1 枚，两份必然不一致）。
  // ★端口是**每次调用现场解引用** `ctx.get('skills')`（与 preset/wiring 那个冻结点同一个道理：
  //   apply 那刻官方服务可能还没 provide）；服务缺席 ⇒ 路由回明确失败码 `ENT_SKILL_DISCOVERY_UNAVAILABLE`
  //   （→503），**绝不静默回空列表**（空列表 = 谎称"你什么都没装"）。
  // ★★**查看作用域（本刀：真机少报修复）**：官方 `skills` 是**层叠注册表** ——
  //   "host rows and repository plugins land in the global layer, while a plugin mounted by an agent
  //    preset's standing composition lands in that preset's layer. A read merges the global layer with
  //    the viewing scope's chain…"。真机上少掉的那 7 枚（`~/.dsh/skills/`）正是挂在 **preset 层**的
  //   `dsh-skill-filesystem` 报出来的（官方 web patch 把宿主那行 `skill-filesystem` 显式 disabled，
  //   "presets own local discovery"）⇒ **不带 scope 的读永远只看得到全局层**（真机读数：3 条，
  //   全是 `provider=dsh-office`）。故这里每次现场向官方 `agentPresets.acquireScope()`（不传 id =
  //   默认/当前 preset）取一枚**引用计数租约**，把 `key` 交给 `snapshot({scope})`，
  //   读完后由路由**必定释放**（不释放 = 每个请求漏一棵 preset 挂载）。
  //   ★租约**原样转交**（不在这里读 `key`、不在这里包装释放）：唯一那道形状闸门与失败码在
  //   `skill-discovery.ts` 的 `projectSkillViewScope`/`acquireSkillViewScope`；
  //   服务缺席回 `undefined` ⇒ 路由判 `step=scope-unavailable` 并**明确失败**，绝不回落成全局层少报。
  //   ★`cwd` **不传**：官方契约里它 "selects project roots"，而这条路由是**无会话的 GET**，
  //   宿主侧没有"当前工作区/项目根"这个事实（`workspaceRegistry` 只有 list/get(id)，没有 current）
  //   ⇒ 拿不到就不传，**绝不猜、不编造路径**（路由那侧只在租约真的带 `cwd` 时才给这一格）。
  // ★不暴露 `path`/`resourceBase`（宿主绝对路径不进浏览器），也不读任何 SKILL.md 正文。
  ctx.effect(() => registerEnterpriseSkillDiscoveryRoute(ctx.webServer, {
    discover: () => {
      const service = ctx.get('skills') as { snapshot?: unknown } | undefined
      // 形状闸门：只有真的带一个函数形状的 `snapshot` 才算"这个服务在场"（不假装、不 `as`）。
      return service !== undefined && typeof service.snapshot === 'function'
        ? (service as { snapshot: (options: { readonly scope: unknown; readonly cwd?: string; readonly signal?: AbortSignal }) => Promise<unknown> })
        : undefined
    },
    acquireScope: async () => {
      const presets = ctx.get('agentPresets') as { acquireScope?: (id?: string) => Promise<unknown> } | undefined
      // 服务缺席 / 形状不对 ⇒ `undefined`（路由判 `scope-unavailable`，**不是**"没有 scope 也能读"）。
      if (presets === undefined || typeof presets.acquireScope !== 'function') return undefined
      // 官方自己的失败（preset 未知 / composition 不可用）**原样抛出**，由路由翻成那一枚稳定码。
      return await presets.acquireScope()
    },
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseSkillDiscovery.routes')
  // 本机三方 Agent 技能源（口径 62：技能页维度行第三枚「本地三方」）。两条 exact 本机路由：
  //   GET  /enterprise/api/v1/local/skills/third-party           → 15 个内建根的盘点 + 候选三态
  //   POST /enterprise/api/v1/local/skills/third-party/install   → 把候选**复制**进 `<dshHome>/skills`
  // ★根表**内建**在本 bundle 里（`skill-third-party.ts` 的 `buildThirdPartySkillRoots`，逐条搬 Cherry
  //   `systemSkillSources.ts` 的 15 个根 + 三个环境变量覆盖），**不由界面声明**、也不占 `extraRoots`
  //   （通路二那条 `extraRoots` 的语义保持"部署注入"不变）。
  // ★★**为什么这一面是"复制"而通路二是"只登记"**（Lead 裁决，两套语义并存但各有名字）：
  //   官方 `skill-filesystem` 只扫 `<dshHome>/skills` 与项目根，而本维度的 15 个根**全都不在**它的扫描
  //   范围内 ⇒ 只登记的话 ① Agent 的 `<available_skills>` 里没有它（**加载不到 = 没真的装**）、
  //   ② 界面「已安装」（读官方发现面 = 磁盘真值）也不会显示它。因此本面走既有**加固落盘**
  //   （`placeEnterpriseSkillArchive`：落点冲突预检 → 暂存 → 逐个原子改名 → 失败整体回滚）把目录复制
  //   进 rank 400 的官方根，再原子写自装记录（七键形状一字不改，`sourceType: 'system'`、来源根 id 进
  //   `sourceInput`）。★**源目录一个字节都不动**（不 move/rsync/删源），★**绝不覆盖**已有同名技能（409）。
  //   ★是否把 `/skills/adopt`（只登记）与这条（复制）统一，**留后续独立裁决**——本刀两条并存，各自有名字。
  // ★不暴露 `path`（宿主绝对路径不进浏览器）：响应只有根的 `{id,name,present,count}` 与技能的
  //   `{id,name,description,rootId,sourceName,directory,status}`。
  // ★扫描抛错 / 端口缺席 ⇒ `503 + ENT_SKILL_THIRD_PARTY_UNAVAILABLE`（该码刻意不进 platform-client 的
  //   码→状态表，落表尾默认档 ⇒ platform-client 零改动），**绝不静默回空列表**。
  ctx.effect(() => registerEnterpriseThirdPartySkillRoutes(ctx.webServer, {
    discover: () => discoverThirdPartySkills(skillInstallOptions),
    install: path => installThirdPartySkill(skillInstallOptions, path),
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseThirdPartySkills.routes')
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
  // 插件侧 NUWAX 员工登录（口径 29：企业后台换成 NUWAX，账号面走员工自己的 NUWAX 账号）。
  // 三条 exact 本机路由：POST /nuwax/login（账号+口令进、登录态出）、POST /nuwax/logout、GET /nuwax/status。
  // ★票据**落盘但绝不回浏览器**：落 `<dshHome>/enterprise/nuwax-session.json`（0o700 目录 + 0o600 文件 +
  //   临时件 rename 原子落），故重启后能静默恢复上一次那枚会话；**口令一个字节都不写**——
  //   没有托管口令就没有自动续期的正当性。响应只给派生的 principal/expiresAt，票据永不出宿主。
  // ★平台地址由部署配置 `DSHENT_NUWAX_ORIGIN` 在**首次登录时**决议（缺配置不拖垮插件启动，每次登录读当前配置）；
  // ★`fetch` 用宿主全局（与在线搜索那条无凭据取数面同一个形状），只打配置里的那一个 origin、且不跟随重定向。
  const nuwaxAuth = createNuwaxSessionHolder({
    fetch: (input: string, init?: RequestInit) => fetch(input, init),
  })
  ctx.effect(() => registerEnterpriseNuwaxRoutes(ctx.webServer, {
    holder: nuwaxAuth,
    onError: (message, error) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  }), 'enterpriseNuwaxAuth.routes')
  // 「专家·技能·连接器」页面的宿主只读代理（口径 31）：浏览器只打同源本机路由，宿主带着**同一枚**员工票据
  // 去 NUWAX 取数——复用上面那个 holder 实例，**绝不**建第二份登录态（否则两处登录态必然漂移）。
  // ★只读是结构性的：闭集（七条字面 + 五条参数化模式，口径 64 B0 新增）全是读端点；
  //   收藏/启停/建连这些写动作不在闭集里；★票据仍不出宿主；响应把平台信封**原样**交回页面。
  // ★**口径 64 B0 的两张许可表**：同一个 `escReadPort` 对象交给两个入口 ——
  //   ① `registerEnterpriseEscReadRoute`（浏览器那条 `POST /esc/read`）只认**浏览器可读表**
  //     = 七条字面 + 三条「我的专家」模式规则；
  //   ② `installPublishedSkill`（下面那条本机安装路由）走 `escReadPort` 的**宿主内部读面**
  //     = 上者 + `/api/published/skill/<id>` 详情 + `/api/published/skill/export/<id>` 制品。
  //   ★**为什么制品（与详情）不进浏览器可读表**：真机实测平台**不执行** `allowCopy`
  //   （`allowCopy=0` 的 `export/700` 照样 200 + 128,784B ZIP）⇒ 合规闸门必须由宿主按
  //   **那一条记录的 targetId** 自己判；这条路径一旦对浏览器开放，`allowCopy` 就形同虚设。
  //   二进制从头到尾不进浏览器：宿主先取详情判合规，**判过才**去取导出 ZIP。
  // ★`mock` 是**演示数据**开关（口径 32）：平台上没有连接器域（`/api/connector/providers` 回
  // `No static resource …`），于是给这一栏留一条"看得到版式"的路。**默认关**——开关是
  // `${DSH_HOME}/enterprise/esc-mock.json` 这个文件（`DSHENT_ESC_MOCK_FILE` 可改址），
  // 缺席/畸形/读不到一律当关；开着时页面顶部常驻一条「模拟数据」横幅，绝不冒充平台数据。
  const escReadPort: EnterpriseEscReadRoutePort = {
    holder: nuwaxAuth,
    mock: () => readEscMockSwitch(process.env),
    onError: (message, error) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  }
  ctx.effect(() => registerEnterpriseEscReadRoute(ctx.webServer, escReadPort), 'enterpriseEsc.routes')
  // ★★**口径 67 Phase C（连接器广场）的宿主半边**：D0 把三条 MCP 只读路径加进 `escReadPort` 的**宿主内部**
  //   许可表（`/api/mcp/list/<spaceId>`、`/api/mcp/deployed/list/<spaceId>`、`/api/mcp/<id>`，
  //   全部 `browserReadable: false`）；D1 就是下面这条 exact 只读路由 ——
  //   `GET /enterprise/api/v1/local/connectors`（实现见新叶 `connector-plaza.ts`）。
  //   ★**为什么 MCP 只读路径只进宿主内部表、浏览器可读表零新增**：这三条命中是**凭据面**。
  //     真机取证（`analysis/connector-plaza-probe.md` §2）：每行 18 键里带 `mcpConfig`/`deployedConfig`，
  //     而 `GET /api/mcp/134` 的 `mcpConfig` **实测就是可直接落地的客户端配置**
  //     `{"mcpServers":{"qixinhuiyan-mcp":{"url":"https://mcp.qixin…"}}}` ⇒ 可能夹带 URL 内嵌凭据、
  //     header、token。进了浏览器可读表就等于把凭据发给前端，故这三条**永不**出现在浏览器那张表里
  //     （与 B0 的 `export/<id>` 是**不同**的理由：那条是合规闸门，这条是凭据面）。
  //   ★**为什么广场必须宿主侧投影**：平台原始行既带配置面、又带 `creatorId`/`uid`/`permissions` 这类
  //     平台内部身份，而界面要的只是"有哪些连接器、各自什么形态"。故本面**从零构造**每条连接器
  //     （不是删字段），出厂只有 `{id,name,description?,icon?,installType,deployStatus,official?,toolCount?,space}`；
  //     `toolCount` 只借 `deployedConfig.tools[]` 的**长度**，配置正文一个字都不出去。
  //   ★**为什么跨空间走逐空间 GET**：`POST /api/mcp/deployed/list` 的真实查询体至今未文档化
  //     （`docs/research/nuwax-plugin-backend-2026-10-06.md` §缺陷 4：`{}` 与 `{spaceId,pageNum,pageSize}`
  //     都回 `5000`），而 `GET /api/mcp/list/<spaceId>` 已有真机读数（空间 3 ⇒ 42 条、248 ⇒ 9 条、2 ⇒ 0 条）
  //     ⇒ 同一条事实用**已有动词**取，不必为一张表再开一套动词支持（也就没有 POST 读面）。
  //   ★**取数面复用同一个 `escReadPort`**：同一份 HTTP 客户端 + 同一枚票据 + 同一套判决（3xx/401/5xx/4xx
  //     与两条上限），本面只是把宿主内部读入口包成"逐空间盘点 + 脱敏投影"；**不新增第二条 HTTP 通道**。
  //   ★**失败绝不静默**：空间列表读不到 / 形状读不懂 ⇒ 本面唯一那枚码 `ENT_CONNECTOR_PLAZA_UNAVAILABLE`
  //     （→503，刻意不进 platform-client 那张码→状态表 ⇒ platform-client 零改动）；某个空间读失败 ⇒ 那个
  //     空间 `ok:false`、其余照出（部分成功保留）；**一个都没成功 ⇒ 明确 503，绝不回空列表**；
  //     空间数与连接器总数各有一枚上限，超限 ⇒ 截断并把 `complete:false` **原样出厂**。
  //   四个判定点（`space-list-failed` / `space-mcp-failed` / `plaza-failed` 与部分失败那一条）都经 `onError` 进 Host 日志。
  ctx.effect(() => registerEnterpriseConnectorPlazaRoute(ctx.webServer, {
    readHostJson: path => readEnterpriseEscHostJson(escReadPort, path),
    onError: (message, error) => {
      ctx.logger.warn(`owndsh: ${message}`, error)
    },
  }), 'enterpriseConnectorPlaza.routes')
  // 口径 64 B0：「系统广场 → 已发布技能 → 导出安装」的本机动作路由（注册面全在 bundle 侧，
  // platform-client 零改动）。它是 `/skills` 那条 prefix 之外的 **exact** sibling（引擎 exact 整表优先）。
  // ★闸门顺序全在 `skill-published.ts`：形状 ⇒ **详情判合规**（`allowCopy !== 1` / `paymentRequired === true`
  //   一律拒，且**在取制品之前**）⇒ 有界取制品（50 MiB 配额）⇒ 共享 ZIP 内核四道门禁 ⇒ frontmatter ⇒
  //   既有加固落盘（**绝不覆盖**）⇒ 自装记录七键（`sourceType: 'system'`、`sourceInput: 'nuwax:<targetId>'`）。
  // ★全程走 `escReadPort` 那同一份「只读面 + 票据」：不新造下载器、不碰平台客户端、不动既有三条通路。
  ctx.effect(() => registerEnterprisePublishedSkillRoute(ctx.webServer, {
    install: targetId => installPublishedSkill({ ...skillInstallOptions, esc: escReadPort }, targetId),
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterprisePublishedSkills.routes')
  // 本刀：**自装技能**的两个宿主动作（卸载 / 打开所在文件夹）。两条 exact sibling 注册在
  //   POST /enterprise/api/v1/local/skills/self-installed/{uninstall,reveal}
  // —— 它们与 platform-client 那条只读 `GET …/skills/self-installed` **并列**（注册面全在 bundle 侧，
  //   platform-client 零改动），且抢在 `skill-route.ts` 那条 `/skills` prefix 之前命中（引擎 exact 整表优先）。
  // ★正文键是 `name`（技能在本机的**目录名**）而不是记录里的 `skillId`：界面「已安装」的真相来自官方发现面
  //   `/skills/discovered`，那份冻结投影里**只有 `name`、没有我们的记录 id**；而 `skillId` 的语义并不统一
  //   （本地上传是 archive 的 `manifest.id`、三方/广场/skillhub 是技能名或 slug）——真正的落盘目录名在记录的
  //   `names[]` 里，故唯一入参口径是「`name` ∈ 某条记录的 `names`」。
  // ★**为什么卸载必须有跨归属判据**：自装记录里的名字可能与**中心 `installed.json` 的某条记录**或
  //   **另一条自装记录**重合（`placeEnterpriseSkillArchive` 的 `ownedElsewhere` 只挡新落点，历史重叠仍在）。
  //   被中心认领 ⇒ 404（那是中心装的东西，归 `/skills/uninstall` 管）；被另一条自装记录也认领 ⇒ 409
  //   fail-closed（重叠状态，不猜一条删掉）；只有**唯一一条**记录独占它才动手 —— 且一包多技能只删这一个目录、
  //   记录保留其余名字（如实进响应），记录里已无别的名字才整条移除。
  // ★**为什么路径只能来自记录**：客户端交来的永远只有 `name` 一个键（"传一个路径进来"在端口形状上
  //   不可表达），落点由宿主按「记录里的名字 + 固定技能根」自己拼，再过 `deleteOwnedSkillDirectory` 那条
  //   `lstat` 普通目录 + `realpath` 落点等式；递归删除**只有那一处实现**（不跟随符号链接、条目数与总字节有界）。
  // ★`reveal` 用**系统文件管理器**打开（argv 调 `open`/`explorer`/`xdg-open`，**无 shell**），失败明确报错：
  //   没有记录认领/被中心认领/目录不在 → 404 `ENT_RESOURCE_NOT_FOUND`、符号链接/越界 → 409、系统交接失败
  //   → 503 `ENT_PLATFORM_UNAVAILABLE`（全是既有码，platform-client 零改动）。
  ctx.effect(() => registerEnterpriseSelfInstalledActionRoutes(ctx.webServer, {
    uninstall: name => uninstallSelfInstalledSkill(skillInstallOptions, name),
    reveal: (name, signal) => revealSelfInstalledSkill(skillInstallOptions, name, signal),
  }, (message, error) => {
    ctx.logger.warn(`owndsh: ${message}`, error)
  }), 'enterpriseSelfInstalledSkills.routes')
  // [组件拆分·块②] Session 同步已抽为 `mountSession`（纯移动，行为未改），返回的 handle 回写外层
  // 变量（block ① 的 sessionLocalPort 闭包读它）；session 已由 bootstrap sessionPolicy 门控。
  sessionSyncHandle = mountSession(ctx, platform, sessions, sessionPersistence)
  // [组件拆分·块③ + 真开关①] 资料库接线（`mountLibrary`）由 `libraryEnabled` 门控：
  // 关 ⇒ 不调用 ⇒ 资料库存储域/本机路由/工具/system-prompt 三面全不挂（块①从不引用 libraryHost，安全）。
  if (config.libraryEnabled) mountLibrary(ctx, platform)
  else ctx.logger.info('dshent: library block disabled by config; faces not mounted [operation=mountLibrary step=skipped]')
  // [组件拆分·块④ + 真开关②] 受管插件分发（`mountPlugins`）由 `pluginsEnabled` 门控：
  // 关 ⇒ 不建分发服务、不接 pluginManager ⇒ block ① 的四个插件路由在调用时 pluginDistribution
  // 仍为 undefined ⇒ 如实抛 "distribution is unavailable"（fail-closed，与服务未就绪同一语义）。
  if (config.pluginsEnabled) {
    mountPlugins(ctx, config, {
      pluginManagerHolder,
      setDistribution: service => { pluginDistribution = service },
    })
  } else {
    ctx.logger.info('dshent: plugin distribution block disabled by config; plugin routes fail closed [operation=mountPlugins step=skipped]')
  }
  // [改名迁移] owner entry id 从 `owndsh` 改成 `dshent` 后，官方 settings 的命名空间随之换名；
  // 升级前填的地址仍挂在旧命名空间下，看不见了。这里把它们搬进新命名空间，升级不丢 Server 地址。
  // 一次性副作用（无待清理资源），故直接调用而非挂在 effect() 上。
  ctx.inject(['settings'], settingsContext => {
    migrateLegacyEntrySettings(settingsContext.settings, ctx.logger)
  })
  // 目标1：官方 `deepseek-account` base 行已停用，账户后台由企业 bundle 用用户自定义地址挂载同一实现。
  // 挂载点已在上面拿到读数（readPlatformOrigin），帮助中心路由与它共用同一份「当前平台地址」。
}
