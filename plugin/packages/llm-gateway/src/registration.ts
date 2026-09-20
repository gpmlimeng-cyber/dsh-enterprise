/**
 * [INPUT]: 依赖 Cordis fiber、官方 dsh-llm-pi-ai 插件、平台 bootstrap 订阅、官方 agentDefaultModel 服务与 Host 私有认证代理
 * [OUTPUT]: 对外提供企业 profiles 指纹驱动的官方插件更新、默认模型同步（占位哨兵收起）和完整幂等 disposer
 * [POS]: llm-gateway 的唯一组合入口；隔离个人 settings，协议实现与模型流生命周期均归官方插件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from '@deepseek-ai/cordis'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import type {
  BootstrapSnapshot,
  EnterprisePlatformStatus,
} from '@dshent/platform-client'
import {
  adoptAdminDefault,
  needsUnsyncedDefaultBridge,
  type AgentDefaultModelPort,
} from './default-model.js'
import { buildEnterpriseProfiles, type EnterpriseProfiles } from './profiles.js'
import {
  startEnterpriseProxy,
  type EnterpriseProxyPlatformPort,
} from './proxy.js'

export interface EnterprisePlatformPort extends EnterpriseProxyPlatformPort {
  bootstrap(): BootstrapSnapshot | undefined
  subscribe(listener: (status: EnterprisePlatformStatus) => void): () => void
}

export interface EnterpriseGatewayOptions {
  readonly platform: EnterprisePlatformPort
  readonly harnessVersion: string
  readonly bundleVersion: string
}

/** 从上下文读取官方 agentDefaultModel；服务缺失或能力不全时返回 undefined。 */
function readAgentDefaultModel(ctx: Context): AgentDefaultModelPort | undefined {
  let candidate: unknown
  try {
    candidate = ctx.get('agentDefaultModel')
  } catch {
    return undefined
  }
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const { currentSelection, saveSelection } = candidate as Partial<
    Pick<AgentDefaultModelPort, 'currentSelection' | 'saveSelection'>
  >
  if (typeof currentSelection !== 'function' || typeof saveSelection !== 'function') return undefined
  const service = candidate as AgentDefaultModelPort
  return {
    currentSelection: () => service.currentSelection(),
    saveSelection: next => service.saveSelection(next),
  }
}

function currentSelectionOf(port: AgentDefaultModelPort | undefined):
  { provider: string; model: string } | undefined {
  if (port === undefined) return undefined
  try {
    return port.currentSelection()
  } catch {
    return undefined
  }
}

/** 挂载并动态配置官方 adapter；返回 disposer，不自行实现任何 LLM wire 语义。 */
export async function registerEnterpriseGateway(
  ctx: Context,
  options: EnterpriseGatewayOptions,
): Promise<() => Promise<void>> {
  const proxy = await startEnterpriseProxy(options)
  const defaultPort = readAgentDefaultModel(ctx)
  let lastAdopted: string | undefined
  let bridge = needsUnsyncedDefaultBridge(currentSelectionOf(defaultPort))
  const build = (): EnterpriseProfiles => buildEnterpriseProfiles(
    options.platform.bootstrap(),
    proxy.baseURL,
    proxy.authorization,
    { includeUnsyncedDefault: bridge },
  )
  let official = ctx.isolate('settings').plugin(LlmPiAi, { providers: build() })
  let fingerprint = JSON.stringify({ providers: build() })
  let active = true
  let updates = Promise.resolve()

  /**
   * 采纳管理员默认并发布档案。顺序保证稳态列表只留真实模型且默认不落空：
   * 1) 若默认仍是占位符，先写真实默认（此刻档案本就无占位符，NO_ADAPTER/UNKNOWN 窗口等价于既有未就绪态）；
   * 2) 发布档案（内容按 bridge 计算）；
   * 3) 发布后再采纳一次（覆盖管理员后续变更）；设置写完若 bridge 状态翻转，重建并再发一版收起哨兵。
   */
  const publish = async (): Promise<void> => {
    if (!active) return
    if (bridge) {
      const first = await adoptAdminDefault(
        defaultPort, build(), options.platform.bootstrap(), lastAdopted,
      )
      if (first.lastAdopted !== undefined) lastAdopted = first.lastAdopted
      bridge = needsUnsyncedDefaultBridge(currentSelectionOf(defaultPort))
    }
    const next = { providers: build() }
    const fingerprintNext = JSON.stringify(next)
    if (fingerprintNext !== fingerprint) {
      fingerprint = fingerprintNext
      await official.update(next, true)
    }
    if (!active) return
    const second = await adoptAdminDefault(
      defaultPort, build(), options.platform.bootstrap(), lastAdopted,
    )
    if (second.lastAdopted !== undefined) lastAdopted = second.lastAdopted
    const bridgeNow = needsUnsyncedDefaultBridge(currentSelectionOf(defaultPort))
    if (bridgeNow !== bridge) {
      bridge = bridgeNow
      const rebuild = { providers: build() }
      const rebuildFingerprint = JSON.stringify(rebuild)
      if (rebuildFingerprint !== fingerprint) {
        fingerprint = rebuildFingerprint
        await official.update(rebuild, true)
      }
    }
  }

  const refresh = (): void => {
    if (!active) return
    updates = updates.then(publish).catch((error: unknown) => {
      ctx.logger.error('enterprise llm: official profile update failed')
      ctx.logger.error(error)
    })
  }
  const unsubscribe = options.platform.subscribe(refresh)
  try {
    await official
    // 已就绪后立即同步一次：平台 READY 可能早于 subscribe 首次触发。
    refresh()
  } catch (error) {
    unsubscribe()
    await proxy.dispose()
    throw error
  }

  return async () => {
    if (!active) return
    active = false
    unsubscribe()
    try {
      await updates
      await official.dispose()
    } finally {
      await proxy.dispose()
    }
  }
}
