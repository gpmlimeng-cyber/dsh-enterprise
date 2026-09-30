/**
 * [INPUT]: 依赖 Cordis fiber、官方 Loader entry 的 config 写入面、平台 bootstrap 订阅与 Host 私有认证代理
 * [OUTPUT]: 对外提供企业 profiles 指纹驱动的官方 pi-ai entry 配置更新和完整幂等 disposer
 * [POS]: llm-gateway 的唯一组合入口；复用 profile 里已挂载的那份官方 dsh-llm-pi-ai，协议实现与模型流生命周期均归官方插件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from '@deepseek-ai/cordis'
import type {
  BootstrapSnapshot,
  EnterprisePlatformStatus,
} from '@dshent/platform-client'
import { buildEnterpriseProfiles, type EnterpriseProfiles } from './profiles.js'
import {
  startEnterpriseProxy,
  type EnterpriseProxyPlatformPort,
} from './proxy.js'

/** 官方 `dsh-llm-pi-ai` 导出的插件名；Loader entry 的 runtime 名即此值。 */
const PI_AI_PLUGIN_NAME = 'llm-pi-ai'
/** 官方 base 行与用户 patch 里该行声明的模块名；entry 尚未初始化时 runtime 名不可读，退回用它识别。 */
const PI_AI_PACKAGE_NAME = '@deepseek-ai/dsh-llm-pi-ai'
/** 空 route 集的指纹；企业目录为空时不需要碰官方那一行的配置。 */
const EMPTY_PROFILES_FINGERPRINT = '{}'

/**
 * 官方 Loader entry 的窄视图：只用到「读当前 config」与「写下一份 config」两个能力。
 *
 * `Entry.update` 是 profile 配置的官方写入面（官方 app-boot 自身也用它调和 profile，
 * `packages/boot/app-boot/src/index.ts:289`），本包不依赖 loader 包类型，故按结构读取。
 */
interface LoaderEntryPort {
  readonly options: { readonly id?: unknown, readonly name?: unknown, readonly config?: unknown }
  readonly fiber?: { readonly runtime?: { readonly name?: unknown } }
  update(options: { readonly config: unknown }): Promise<void>
}

/** 官方 `ctx.configEditor`：活动 profile 里可寻址的配置行。 */
interface ConfigEditorPort {
  entries(): readonly LoaderEntryPort[]
}

export interface EnterprisePlatformPort extends EnterpriseProxyPlatformPort {
  bootstrap(): BootstrapSnapshot | undefined
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
}

export interface EnterpriseGatewayOptions {
  readonly platform: EnterprisePlatformPort
  readonly harnessVersion: string
  readonly bundleVersion: string
}

/** 配置层只可能是普通对象；数组与 null 一律按「没有」处理，避免把现场写坏。 */
function plainRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

/**
 * 在活动 profile 里定位**已挂载**的那份官方 pi-ai 行。
 *
 * @param ctx - bundle 组合根上下文。
 * @returns 该 Loader entry；profile 没有这一行（或没有 configEditor）时 undefined。
 */
function mountedPiAiEntry(ctx: Context): LoaderEntryPort | undefined {
  const editor = ctx.get('configEditor') as ConfigEditorPort | undefined
  if (editor === undefined) return undefined
  return editor.entries().find(row =>
    row.fiber?.runtime?.name === PI_AI_PLUGIN_NAME || row.options.name === PI_AI_PACKAGE_NAME)
}

/**
 * 把企业 profiles 注册进 profile 里**已挂载的那份官方 pi-ai**，不再挂第二份实例。
 *
 * 官方入口是那一行自己的 `providers` 配置：官方 `Config` 只有 `providers` 一个字段，且声明为
 * volatile（`packages/llm/llm-pi-ai/src/config.ts:353`），README 也写明「The `providers` dictionary
 * is the whole configuration surface」。官方 Loader 对 volatile-only 的 config 写入不重启 fiber，
 * 而是把新值提交进运行中的 Config 引用并发出 `loader/volatile-update`
 * （`@deepseek-ai/cordis-plugin-loader` `Entry.update` → `_commitVolatile`），而 pi-ai 正监听该事件
 * 原地重注册路由与可配置 provider 目录（`packages/llm/llm-pi-ai/src/index.ts:310`）。
 *
 * 写入只发生在内存。企业 route 的 `baseURL` 是每次启动随机的回环端口、`headers.authorization` 是
 * 进程内 bearer，走 `settings.update` 会把它们持久化进用户 profile 的 `cordis.patch.yml`，因此这里用
 * Loader 的 config 写入面而不是 settings 文档写入面。用户自己的 provider 逐字保留，企业 route 只
 * 增删自己的键空间。
 *
 * @param ctx - bundle 组合根上下文。
 * @param options - 平台端口与版本事实。
 * @returns disposer：撤回本次贡献的企业 route 并释放 Host 私有代理。
 */
export async function registerEnterpriseGateway(
  ctx: Context,
  options: EnterpriseGatewayOptions,
): Promise<() => Promise<void>> {
  const entry = mountedPiAiEntry(ctx)
  if (entry === undefined) {
    // 官方 base 行缺席时企业模型无处安放：如实报错，但不阻断平台登录/插件市场等其余能力。
    ctx.logger.error(
      'enterprise llm: the official llm-pi-ai plugin is not mounted in this profile;'
      + ' enterprise model routes stay unavailable',
    )
    return async () => {}
  }
  const proxy = await startEnterpriseProxy(options)
  const profiles = (): EnterpriseProfiles => buildEnterpriseProfiles(
    options.platform.bootstrap(),
    proxy.baseURL,
    proxy.authorization,
  )
  let fingerprint = EMPTY_PROFILES_FINGERPRINT
  let contributed: readonly string[] = []
  let active = true
  let updates: Promise<void> = Promise.resolve()

  /**
   * 把一份 profiles 写进 pi-ai entry 的配置。
   *
   * 先撤回上一次贡献的 route，再写入本次的；其余键（用户自己声明的 provider）逐字保留。
   * 只有写入成功才推进 `contributed`，失败时下一次仍按上一份键集合清理。
   */
  const publish = async (next: EnterpriseProfiles): Promise<void> => {
    const config = plainRecord(entry.options.config)
    const providers = plainRecord(config['providers'])
    for (const provider of contributed) Reflect.deleteProperty(providers, provider)
    for (const [provider, profile] of Object.entries(next)) providers[provider] = profile
    await entry.update({ config: { ...config, providers } })
    contributed = Object.keys(next)
  }

  /**
   * 本次贡献是否仍在 pi-ai 行的 config 里。
   *
   * 官方在改写这一行的 config 时会**整体重提交**（例如模型选择写回），持久化值里没有我们注入的
   * providers ⇒ 贡献被抹掉。指纹只记录"我们算过什么"，不能证明"它还在"，所以跳过前必须核实。
   */
  const contributionIntact = (): boolean => {
    if (contributed.length === 0) return true
    const providers = plainRecord(plainRecord(entry.options.config)['providers'])
    return contributed.every(key => providers[key] !== undefined)
  }

  const applyProfiles = async (): Promise<void> => {
    const next = profiles()
    const nextFingerprint = JSON.stringify(next)
    if (nextFingerprint === fingerprint && contributionIntact()) return
    await publish(next)
    fingerprint = nextFingerprint
  }

  const refresh = (): void => {
    if (!active) return
    updates = updates
      .then(async () => { if (active) await applyProfiles() })
      .catch((error: unknown) => {
        ctx.logger.error('enterprise llm: official pi-ai route update failed')
        ctx.logger.error(error)
      })
  }
  const unsubscribe = options.platform.subscribe(refresh)
  // 官方改这一行 config 时会整体重提交我们的贡献，settings 文档更新是其中一条已知路径：
  // 这里补一次，配合 contributionIntact 让注入自愈（无 effect/on 能力的宿主自动跳过）。
  if (typeof ctx.effect === 'function' && typeof ctx.on === 'function') {
    // 该事件由官方 settings 插件发出：bundle 侧同一事件名是类型安全的，而本包 Context 的类型
    // 来自 cordis、未声明它，故只把 `on` 收窄成"(事件名, 处理函数) -> 注销器"；运行期事件真实存在。
    const onSettingsDocumentUpdated = ctx.on as unknown as
      (event: string, handler: () => void) => () => void
    ctx.effect(
      () => onSettingsDocumentUpdated('settings/document-updated', () => { refresh() }),
      'enterpriseGateway.settingsWatch',
    )
  }
  try {
    await applyProfiles()
  } catch (error) {
    unsubscribe()
    await proxy.dispose()
    throw error
  }

  return async () => {
    if (!active) return
    active = false
    unsubscribe()
    await updates
    try {
      if (contributed.length > 0) await publish({})
    } catch (error) {
      ctx.logger.warn('enterprise llm: failed to withdraw the enterprise routes from the official pi-ai plugin')
      ctx.logger.warn(error)
    } finally {
      await proxy.dispose()
    }
  }
}
