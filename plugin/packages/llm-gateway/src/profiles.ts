/**
 * [INPUT]: 依赖平台 bootstrap 的受管模型事实、Host 私有代理地址/bearer 与官方 dsh-llm-pi-ai profile 类型
 * [OUTPUT]: 对外提供三协议企业 route、动态 default sentinel 与遵循官方重试默认值的纯 profile 投影
 * [POS]: llm-gateway 的配置桥，只翻译企业目录事实，不接触消息、工具、回放、SSE 或上游凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  PiAiCompatProfile,
  PiAiModelProfile,
  PiAiProviderProfile,
  PiAiReasoningEfforts,
} from '@deepseek-ai/dsh-llm-pi-ai'
import type { BootstrapSnapshot } from '@dshent/platform-client'

export const ENTERPRISE_DEFAULT_PROVIDER = 'enterprise'
export const ENTERPRISE_DEFAULT_MODEL = 'enterprise/default'
/** 哨兵模型的展示名：不带任何“企业”字样，避免与真实模型名拼接后缀产生噪音。 */
export const ENTERPRISE_SENTINEL_DISPLAY_NAME = '跟随管理员默认'

export type EnterpriseApiProtocol = BootstrapSnapshot['models'][number]['apiProtocol']
export type EnterpriseProfiles = Record<string, PiAiProviderProfile>

const ROUTES: Readonly<Record<EnterpriseApiProtocol, string>> = {
  'openai-completions': 'enterprise-openai-completions',
  'openai-responses': 'enterprise-openai-responses',
  'anthropic-messages': 'enterprise-anthropic-messages',
}

const DISPLAY_NAMES: Readonly<Record<EnterpriseApiProtocol, string>> = {
  'openai-completions': '企业模型 · Chat Completions',
  'openai-responses': '企业模型 · Responses',
  'anthropic-messages': '企业模型 · Anthropic Messages',
}

function modelProfile(
  model: BootstrapSnapshot['models'][number],
  id = model.alias,
  name = model.name ?? model.alias,
): PiAiModelProfile {
  const reasoningEfforts = model.reasoningEfforts === false
    ? false
    : model.reasoningEfforts === undefined
      ? undefined
      : Object.fromEntries(
        Object.entries(model.reasoningEfforts).filter((entry): entry is [string, string | null] => entry[1] !== undefined),
      ) as PiAiReasoningEfforts
  const compat = model.compat === undefined
    ? undefined
    : Object.fromEntries(Object.entries(model.compat).filter(([, value]) => value !== undefined)) as PiAiCompatProfile
  return {
    id,
    name,
    input: ['text'],
    ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
    ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
    ...reasoningEfforts === undefined ? {} : { reasoningEfforts },
    ...compat === undefined ? {} : { compat },
  }
}

function providerProfile(
  api: EnterpriseApiProtocol,
  baseURL: string,
  authorization: string,
  displayName: string,
  models: PiAiModelProfile[],
): PiAiProviderProfile {
  // Anthropic SDK 自行追加 /v1/messages；OpenAI SDK 则要求 baseURL 已包含 /v1。
  const sdkBaseURL = api === 'anthropic-messages' ? baseURL.replace(/\/v1$/, '') : baseURL
  return {
    api,
    baseURL: sdkBaseURL,
    displayName,
    models,
    headers: { authorization },
  }
}

/**
 * 将一次脱敏 bootstrap 快照投影为官方 adapter 的完整 route 配置。
 *
 * 官方模型选择器按 provider 1:1 生成分组（组名 = provider.displayName）。
 * 因此：
 * - 单协议部署把全部模型并入唯一的 `enterprise` provider，选择器只出现**一个分组**；
 *   provider 键保持 `enterprise`，与 cordis.patch 的 `provider: enterprise` 一致。
 * - 多协议无法共用一个 provider（provider 只能声明一种 api/baseURL），退回按协议分组，
 *   并保留独立的 `enterprise` 哨兵分组。
 */
export function buildEnterpriseProfiles(
  snapshot: BootstrapSnapshot | undefined,
  baseURL: string,
  authorization: string,
): EnterpriseProfiles {
  if (snapshot === undefined) return {}
  const selected = snapshot.models.find(model => model.isDefault)
  const protocols = [...new Set(snapshot.models.map(model => model.apiProtocol))]

  if (selected !== undefined && protocols.length === 1 && selected.apiProtocol === protocols[0]) {
    const api = selected.apiProtocol
    const models = snapshot.models
      .filter(model => model.apiProtocol === api)
      .map(model => modelProfile(model))
    models.push(modelProfile(selected, ENTERPRISE_DEFAULT_MODEL, ENTERPRISE_SENTINEL_DISPLAY_NAME))
    return {
      [ENTERPRISE_DEFAULT_PROVIDER]: providerProfile(api, baseURL, authorization, DISPLAY_NAMES[api], models),
    }
  }

  const profiles: EnterpriseProfiles = {}
  for (const api of Object.keys(ROUTES) as EnterpriseApiProtocol[]) {
    const models = snapshot.models.filter(model => model.apiProtocol === api).map(model => modelProfile(model))
    if (models.length > 0) profiles[ROUTES[api]] = providerProfile(api, baseURL, authorization, DISPLAY_NAMES[api], models)
  }
  if (selected !== undefined) {
    profiles[ENTERPRISE_DEFAULT_PROVIDER] = providerProfile(
      selected.apiProtocol,
      baseURL,
      authorization,
      '企业模型',
      [modelProfile(selected, ENTERPRISE_DEFAULT_MODEL, ENTERPRISE_SENTINEL_DISPLAY_NAME)],
    )
  }
  return profiles
}
