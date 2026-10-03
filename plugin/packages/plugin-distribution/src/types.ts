/**
 * [INPUT]: 依赖 platform-client bootstrap、contracts 受管状态与官方 Host plugin inventory 公共类型
 * [OUTPUT]: 对外提供含可选验签开关的分发 Config（**不再有 CLI 相关的 profile/dshCommand/subprocessGraceMs**）、企业目录（条目含 `displayName?` 标题与 `description?` 第二行）/本机安装快照（记录含本机私有启停位 `enabled`）及平台/官方运行时窄 port
 * [POS]: plugin-distribution 的依赖倒置层，使业务状态机只依赖官方能力契约而不耦合实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from '@deepseek-ai/cordis'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-host-plugin-inventory'
import type { ManagedPluginState } from '@dshent/contracts'
import type {
  BootstrapSnapshot,
  EnterprisePlatformStatus,
} from '@dshent/platform-client'

export type RuntimePluginAssignment = BootstrapSnapshot['plugins']['assignments'][number]

/** platform-client 的七方法中本模块实际消费的最小只读/请求面。 */
export interface EnterprisePlatformPort {
  status(): EnterprisePlatformStatus
  bootstrap(): BootstrapSnapshot | undefined
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
  request(input: string | URL, init?: RequestInit): Promise<Response>
}

/** 兼容 rc.2 同步与后续异步 Host plugin inventory 的只读投影。 */
export interface PluginInventoryPort {
  list(): PluginInventorySnapshot | Promise<PluginInventorySnapshot>
}

/** 受管状态文件的一条中心 package 记录。 */
export interface ManagedPluginRecord {
  readonly packageName: string
  readonly version: string | null
  readonly sha256: string | null
  /**
   * **本机私有**启停位（`managed-plugins.json` 的本机形状，**不是**服务端契约、不进生成物）。
   *
   * 只表达「用户在这台设备上要不要这枚**已安装**的插件参与运行」，与 `desiredState`（装/卸，中心决定）
   * 正交；置位走官方 `setBundleEnabled`（只改 profile 的 bundle 层，不卸载依赖）。
   * 旧记录没有这一枚键时**读时归一为 `true`**（见 `state-store.ts` 的 `parsePlugin`），不做迁移。
   */
  readonly enabled: boolean
  readonly desiredRevision: number
  readonly desiredState: 'INSTALLED' | 'ABSENT'
  readonly state: ManagedPluginState
  readonly lastErrorCode: string | null
  /** 写入 RESTART_REQUIRED 的进程代号；只有下一进程可以确认 Loader 结果。 */
  readonly restartMarker: string | null
}

/** `$DSH_HOME/enterprise/managed-plugins.json` 的版本化根对象。 */
export interface ManagedPluginsFile {
  readonly formatVersion: 1
  readonly assignmentRevision: number
  readonly plugins: readonly ManagedPluginRecord[]
}

/** Host 与未来本地 UI 读取的脱敏分发状态。 */
export interface PluginDistributionStatus {
  readonly assignmentRevision: number
  readonly plugins: readonly ManagedPluginRecord[]
  readonly catalog: readonly {
    readonly pluginVersionId: string
    readonly packageName: string
    readonly version: string
    /**
     * 制品 `package.json` 的 `displayName`（契约 `PluginDisplayName`，1..120）——员工端卡片**标题**取值。
     * 服务端永远有值（验包器读不到时已回退成包名），故这里**有就原样带走**；只有**旧服务端**
     * （这一刀之前那批 bootstrap 不带该键）才会缺席，ui 的解码白名单与渲染层据此回退成包名
     * （不空白、不编造）——这是刻意的兼容窗口，不是本模块的选择性投影。
     */
    readonly displayName?: string
    /**
     * 制品 `package.json` 的 `description`（契约 `PluginDescription`，≤1000）。
     * **可选**：bootstrap 那一侧没有这个键时这里就没有这个键（绝不补空串、不编造）——
     * ui 的解码白名单把「缺席」当唯一缺失口径，卡片第二行据此如实降级成「暂无描述」。
     */
    readonly description?: string
    /**
     * 制品 tar 里那份 README 的纯文本（契约 `PluginReadme`，≤65536）——员工端插件详情「描述」段的
     * **首选**取值（口径 20：描述来自 README，没有才回落到上一枚短 `description`）。
     * **可选**：bootstrap 那一侧没有这个键时这里就没有这个键（绝不补空串、不编造）——
     * ui 的解码白名单把「缺席」当唯一缺失口径。
     */
    readonly readme?: string
    readonly sizeBytes: number
    readonly operatingSystems: readonly string[]
    readonly installErrorCode?: string
  }[]
  readonly fatalErrorCode?: string
  readonly lastReportErrorCode?: string
}

/** 安装层控制验签策略；默认关闭，开启后缺失信任根会阻止受管安装。 */
export interface PluginDistributionConfig {
  readonly verifyPluginSignatures?: boolean
  readonly trustedPluginPublicKey?: string
  /** 可选的已验证 Harness commit；未知运行时保持缺省并拒绝受管制品安装。 */
  readonly harnessCommit?: string
  readonly bundleVersion: string
  readonly dshHome?: string
}

/**
 * 官方安装面的**唯一**落点。
 *
 * 本 Service 不再需要 `subprocess`：安装/卸载/取消一律走官方 `pluginManager`（`./manager.ts` 的
 * `ManagedPluginManagerPort`），由 bundle 组合层经官方 inject 声明**延迟**注入。
 */
export interface PluginDistributionContext extends Context {
  readonly pluginInventory: PluginInventoryPort
}
