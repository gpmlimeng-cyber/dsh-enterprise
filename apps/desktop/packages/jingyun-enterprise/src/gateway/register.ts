/**
 * [INPUT]: 依赖 @deepseek-ai/cordis 的 Context、官方 @deepseek-ai/dsh-llm-pi-ai 插件、protocol/types 的 bootstrap 与平台状态类型、gateway 的 profiles/proxy
 * [OUTPUT]: 对外提供 registerEnterpriseGateway 与 EnterprisePlatformPort/EnterpriseGatewayOptions 类型
 * [POS]: gateway 的唯一组合入口；协议实现、模型目录解析与流生命周期全归官方插件，本文件只做指纹幂等更新与有序拆卸
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from '@deepseek-ai/cordis'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import type {
  EnterpriseBootstrapSnapshot,
  EnterprisePlatformStatus,
} from '../protocol/types.js'
import { buildEnterpriseProfiles, type EnterpriseProfiles } from './profiles.js'
import { startEnterpriseGatewayProxy, type EnterpriseGatewayProxyPort } from './proxy.js'

/** 控制面必须提供的最小能力；E1 的 EnterpriseControlPlane 结构化满足它。 */
export interface EnterprisePlatformPort extends EnterpriseGatewayProxyPort {
  bootstrap(): EnterpriseBootstrapSnapshot | undefined
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
}

export interface EnterpriseGatewayOptions {
  readonly platform: EnterprisePlatformPort
  readonly harnessVersion: string
  readonly bundleVersion: string
}

/**
 * 挂载并动态配置官方 adapter，返回完整 disposer。
 * 注册顺序：先起本地代理（拿到 baseURL 与占位 bearer），再把 profile 投影交给官方插件；
 * 更新只在 profile JSON 指纹变化时发生，官方插件自身负责重载 route。
 */
export async function registerEnterpriseGateway(
  ctx: Context,
  options: EnterpriseGatewayOptions,
): Promise<() => Promise<void>> {
  const proxy = await startEnterpriseGatewayProxy({ platform: options.platform })
  const profiles = (): EnterpriseProfiles =>
    buildEnterpriseProfiles(options.platform.bootstrap(), proxy.baseURL, proxy.authorization)
  const initial = { providers: profiles() }
  const official = ctx.isolate('settings').plugin(LlmPiAi, initial)
  let fingerprint = JSON.stringify(initial)
  let active = true
  let updates: Promise<void> = Promise.resolve()

  // 订阅回调不得抛出：它运行在控制面的通知循环里。投影或指纹失败只降级为日志。
  const refresh = (): void => {
    if (!active) return
    let next: { providers: EnterpriseProfiles }
    try {
      next = { providers: profiles() }
    } catch (error) {
      ctx.logger.error('enterprise gateway: 企业模型 profile 投影失败')
      ctx.logger.error(error)
      return
    }
    const nextFingerprint = JSON.stringify(next)
    if (nextFingerprint === fingerprint) return
    fingerprint = nextFingerprint
    // 更新串行化：controller 或网络短暂乱序时，最后一次投影必须最后落地。
    updates = updates
      .then(async () => {
        await official
        if (active) await official.update(next, true)
      })
      .catch((error: unknown) => {
        ctx.logger.error('enterprise gateway: 官方 pi-ai profile 更新失败')
        ctx.logger.error(error)
      })
  }

  const unsubscribe = options.platform.subscribe(refresh)
  try {
    await official
  } catch (error) {
    // 官方插件挂载失败：释放刚起的代理再上抛，由 Cordis fiber 记录为失败状态（绝不 process.exit）。
    unsubscribe()
    await proxy.dispose().catch(() => undefined)
    throw error
  }
  // 只在官方插件确实挂载成功后记录本次投影的运行身份；两个版本号也仅有此处用途。
  ctx.logger.info(
    'enterprise gateway: 已挂载企业模型 route（harness %s / bundle %s）',
    options.harnessVersion,
    options.bundleVersion,
  )

  return async (): Promise<void> => {
    if (!active) return
    active = false
    unsubscribe()
    try {
      await updates
      await official.dispose()
    } catch (error) {
      ctx.logger.error('enterprise gateway: 官方 pi-ai 插件卸载失败')
      ctx.logger.error(error)
    } finally {
      try {
        await proxy.dispose()
      } catch (error) {
        ctx.logger.error('enterprise gateway: 本机认证代理关闭失败')
        ctx.logger.error(error)
      }
    }
  }
}
