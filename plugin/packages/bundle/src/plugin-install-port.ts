/**
 * [INPUT]: 只做 `typeof`/对象形状判断，**不 import 任何 `@deepseek-ai/*` 的运行时值**、不 import 本包其它模块（含 `errors.js`——错误码归各纵深自己）
 * [OUTPUT]: 官方唯一安装面的**横切端口层**：结构面 `OfficialPluginManagerLike`、官方 `ChangeResult` 的受控投影 `OfficialBundleApplication` + `projectOfficialResult`、形状闸门 `isOfficialPluginManager`、两个 ctx 取值器 `pluginManagerFromContext` / `profileDirFromContext`
 * [POS]: bundle 包内**配方（`preset/install.ts`）与连接器（`connector/install.ts`）两个纵深共用**的那一层。抽出来的理由不是"少写几行"，而是 `connector-architecture.md` §8.2 第 1 条逐字要求「**不做第二个安装器 / 第二套运行时**」——官方规范只认一个安装面（`references/host-plugin.md:58`），故两个纵深必须共用**同一份**官方面描述与同一份结果投影，而不是各写一份、日后各自漂移。本文件**不含**任何编排语义（幂等、并发、账本、授权都在各纵深自己那层）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 官方 `ChangeResult.application` 的完整取值；**原样透出**，不由我们折叠。 */
export type OfficialApplication = 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'

/** 给界面的三态（`hot` = 官方 `applied`；官方原值另存 `officialApplication`）。 */
export type OfficialApplicationKind = 'hot' | 'restart-required' | 'other'

/** 官方安装/卸载结果的**受控投影**：只保留稳定字段，不放 pnpm 输出与宿主路径。 */
export interface OfficialBundleApplication {
  readonly target: string
  readonly changed: boolean
  readonly application: OfficialApplication
  readonly stage?: string
  readonly enabled?: boolean
  readonly warnings?: readonly string[]
  readonly failedAt?: 'registry' | 'spec-host'
  readonly error?: { readonly code?: string; readonly diagnostic?: string }
}

/** 官方 `PluginManager` 的结构面（不 import 官方包，保持 bundle 的 peer 边界）。 */
export interface OfficialPluginManagerLike {
  installBundle(spec: string, options?: unknown): Promise<unknown>
  removeBundle(name: string): Promise<unknown>
}

export const OFFICIAL_APPLICATIONS: readonly OfficialApplication[] =
  ['applied', 'restart-required', 'overridden', 'failed', 'cancelled']

/** 官方原值 → 界面三态（两处纵深同一根判据）。 */
export function officialApplicationKind(application: OfficialApplication): OfficialApplicationKind {
  if (application === 'applied') return 'hot'
  if (application === 'restart-required') return 'restart-required'
  return 'other'
}

export function readOfficialApplication(value: unknown): OfficialApplication {
  return typeof value === 'string' && (OFFICIAL_APPLICATIONS as readonly string[]).includes(value)
    ? value as OfficialApplication
    : 'failed'
}

export function readOfficialWarnings(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const warnings = value.filter((item): item is string => typeof item === 'string')
  return warnings.length === 0 ? undefined : warnings
}

export function readOfficialError(value: unknown): OfficialBundleApplication['error'] {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const code = typeof row['code'] === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(row['code']) ? row['code'] : undefined
  const diagnostic = typeof row['diagnostic'] === 'string' && row['diagnostic'].length <= 512 ? row['diagnostic'] : undefined
  if (code === undefined && diagnostic === undefined) return undefined
  return { ...(code === undefined ? {} : { code }), ...(diagnostic === undefined ? {} : { diagnostic }) }
}

/** 把一个官方 `ChangeResult` 逐字段投影成 `OfficialBundleApplication`（缺失字段不伪造）。 */
export function projectOfficialResult(target: string, value: unknown): OfficialBundleApplication {
  if (typeof value !== 'object' || value === null) {
    return { target, changed: false, application: 'failed' }
  }
  const row = value as Record<string, unknown>
  const failedAt = row['failedAt'] === 'registry' || row['failedAt'] === 'spec-host' ? row['failedAt'] : undefined
  const error = readOfficialError(row['error'])
  const warnings = readOfficialWarnings(row['warnings'])
  return {
    target: typeof row['target'] === 'string' ? row['target'] : target,
    changed: row['changed'] === true,
    application: readOfficialApplication(row['application']),
    ...(typeof row['stage'] === 'string' ? { stage: row['stage'] } : {}),
    ...(typeof row['enabled'] === 'boolean' ? { enabled: row['enabled'] } : {}),
    ...(warnings === undefined ? {} : { warnings }),
    ...(failedAt === undefined ? {} : { failedAt }),
    ...(error === undefined ? {} : { error }),
  }
}

/** 形状闸门：只有**同时**具备两个方法才算官方安装面（缺一个即不认，不做半可用降级）。 */
export function isOfficialPluginManager(value: unknown): value is OfficialPluginManagerLike {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate['installBundle'] === 'function' && typeof candidate['removeBundle'] === 'function'
}

/** 官方服务可达性：普通 Host 插件 `ctx.get('pluginManager')` 即可（spike §4 实证）。 */
export function pluginManagerFromContext(ctx: { get(name: string): unknown }): OfficialPluginManagerLike | undefined {
  const manager = ctx.get('pluginManager')
  return isOfficialPluginManager(manager) ? manager : undefined
}

/** 当前 profile 目录（`profileContext.dir`）；不在 profile 启动的进程里返回 undefined。 */
export function profileDirFromContext(ctx: { get(name: string): unknown }): string | undefined {
  const profile = ctx.get('profileContext')
  if (typeof profile !== 'object' || profile === null) return undefined
  const dir = (profile as Record<string, unknown>)['dir']
  return typeof dir === 'string' && dir.length > 0 ? dir : undefined
}
