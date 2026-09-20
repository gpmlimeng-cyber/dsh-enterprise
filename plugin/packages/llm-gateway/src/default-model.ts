/**
 * [INPUT]: 依赖 piAi profiles 目录形状与官方 agentDefaultModel 服务的读写端口。
 * [OUTPUT]: 对外提供占位哨兵判定、管理员默认采纳决策与「模型归属哪个 provider」解析。
 * [POS]: llm-gateway 的默认模型同步纯逻辑；不接触 Cordis 实例、settings 实现或网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { BootstrapSnapshot } from '@dshent/platform-client'
import type { EnterpriseProfiles, EnterpriseProfiles as Profiles } from './profiles.js'
import { ENTERPRISE_DEFAULT_MODEL, ENTERPRISE_DEFAULT_PROVIDER } from './profiles.js'

/** 官方 `ctx.agentDefaultModel` 的窄端口；只取同步所需的两个能力。 */
export interface AgentDefaultModelPort {
  currentSelection(): { readonly provider: string; readonly model: string }
  saveSelection(next: { readonly provider: string; readonly model: string }): Promise<void>
}

/** 当前默认仍指向未同步的占位符（或尚未可读）时，需要保留 enterprise/default 桥接。 */
export function needsUnsyncedDefaultBridge(
  current: { provider: string; model: string } | undefined,
): boolean {
  if (current === undefined) return true
  return current.provider === ENTERPRISE_DEFAULT_PROVIDER && current.model === ENTERPRISE_DEFAULT_MODEL
}

/** 解析一个模型 id 归属的 provider 路由键；多协议与单协议合并两种形态都适用。 */
export function providerKeyForModel(profiles: Profiles, modelId: string): string | undefined {
  for (const [key, profile] of Object.entries(profiles)) {
    if (profile.models?.some(model => model.id === modelId)) return key
  }
  return undefined
}

/**
 * 是否应把默认改成管理员当前真实模型。
 * 仅当「仍是占位符」或「上一次就是我们跟写的值」时才覆盖；
 * 用户在设置里自选的默认一律不动。
 */
export function shouldAdoptAdminDefault(
  current: { provider: string; model: string } | undefined,
  lastAdopted: string | undefined,
  adminAlias: string,
  providerKey: string | undefined,
): boolean {
  if (providerKey === undefined) return false
  if (current === undefined) return false
  if (current.provider === providerKey && current.model === adminAlias) return false
  if (needsUnsyncedDefaultBridge(current)) return true
  return lastAdopted !== undefined && current.model === lastAdopted
}

export interface AdoptAdminDefaultResult {
  readonly changed: boolean
  readonly lastAdopted: string | undefined
}

/**
 * 读取 bootstrap 默认、定位其 provider、按决策写回官方 agentDefaultModel。
 * 返回值 `changed` 为 true 表示设置已被写入，调用方应重建 profiles（桥接可能需要收起）。
 */
export async function adoptAdminDefault(
  port: AgentDefaultModelPort | undefined,
  providers: EnterpriseProfiles,
  bootstrap: BootstrapSnapshot | undefined,
  lastAdopted: string | undefined,
): Promise<AdoptAdminDefaultResult> {
  if (port === undefined) return { changed: false, lastAdopted }
  const admin = bootstrap?.models.find(model => model.isDefault)
  if (admin === undefined) return { changed: false, lastAdopted }
  const providerKey = providerKeyForModel(providers, admin.alias)
  if (providerKey === undefined) return { changed: false, lastAdopted }

  let current: { provider: string; model: string }
  try {
    current = port.currentSelection()
  } catch {
    return { changed: false, lastAdopted }
  }

  if (!shouldAdoptAdminDefault(current, lastAdopted, admin.alias, providerKey)) {
    // 已与管理员默认一致（含用户重启后从 settings 恢复的场景）：记住它，之后管理员改默认才继续跟随。
    if (current.provider === providerKey && current.model === admin.alias) {
      return { changed: false, lastAdopted: admin.alias }
    }
    return { changed: false, lastAdopted }
  }

  try {
    await port.saveSelection({ provider: providerKey, model: admin.alias })
  } catch {
    return { changed: false, lastAdopted }
  }
  return { changed: true, lastAdopted: admin.alias }
}
