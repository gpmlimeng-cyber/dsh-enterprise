/**
 * [INPUT]: 依赖 protocol/types 的三协议枚举、bootstrap 模型事实与 ENTERPRISE_PROVIDER/ENTERPRISE_DEFAULT_MODEL 哨兵，依赖官方 @deepseek-ai/dsh-llm-pi-ai 的 profile 类型
 * [OUTPUT]: 对外提供 buildEnterpriseProfiles 纯投影与 EnterpriseProfiles 类型
 * [POS]: gateway 的配置桥；只把企业目录事实翻译成官方 pi-ai 的 provider route，不接触消息、tools、reasoning 线格式、replay 与 SSE
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  PiAiCompatProfile,
  PiAiModelProfile,
  PiAiProviderProfile,
  PiAiReasoningEfforts,
  PiAiThinkingFormat,
} from '@deepseek-ai/dsh-llm-pi-ai'
import {
  ENTERPRISE_DEFAULT_MODEL,
  ENTERPRISE_PROVIDER,
  type EnterpriseApiProtocol,
  type EnterpriseBootstrapModel,
  type EnterpriseBootstrapSnapshot,
} from '../protocol/types.js'

/** provider route 字典：键就是官方 pi-ai 的 route 名。 */
export type EnterpriseProfiles = Record<string, PiAiProviderProfile>

/** 三条 route 的分组顺序；同时决定 profile 指纹的字段顺序，必须稳定。 */
const PROTOCOLS: readonly EnterpriseApiProtocol[] = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
]

/** 分组 route 的展示名；企业默认哨兵 route 另用「企业模型」。 */
const DISPLAY_NAMES: Readonly<Record<EnterpriseApiProtocol, string>> = {
  'openai-completions': '企业模型 · Chat Completions',
  'openai-responses': '企业模型 · Responses',
  'anthropic-messages': '企业模型 · Anthropic Messages',
}

/** 企业默认哨兵 route 的展示名。 */
const DEFAULT_DISPLAY_NAME = '企业模型'

/**
 * 官方 pi-ai 真正认识的推理方言。
 * 类型标注本身就是漂移门禁：pi-ai 一旦删改任一取值，这里立即编译失败。
 * 中心契约里超出本集合的取值（minimax/kimi/longcat 一类）pi-ai 无对应实现，
 * 必须剔除而不是透传，否则整条 route 会在 profile 校验时被判为不可服务。
 */
const SUPPORTED_THINKING_FORMATS: readonly PiAiThinkingFormat[] = [
  'openai',
  'openrouter',
  'deepseek',
  'together',
  'baseten',
  'zai',
  'qwen',
  'chat-template',
  'qwen-chat-template',
  'string-thinking',
  'ant-ling',
]

const THINKING_FORMATS: ReadonlySet<string> = new Set<string>(SUPPORTED_THINKING_FORMATS)

/** route 名 = `enterprise-<api>`，与 INTERFACES §3 冻结的三条名字逐字一致。 */
function routeName(api: EnterpriseApiProtocol): string {
  return `${ENTERPRISE_PROVIDER}-${api}`
}

/**
 * 剔除值为 undefined 的字段；null 必须保留（`reasoningEfforts.off` 的 null 语义是「支持但不发送」）。
 * 全部字段都被剔除时返回 undefined，使投影不产出空声明。
 */
function pruneUndefined(source: object): Record<string, unknown> | undefined {
  const kept = Object.entries(source).filter(([, value]) => value !== undefined)
  return kept.length === 0 ? undefined : Object.fromEntries(kept)
}

/** `reasoningEfforts === false` 原样传递（声明为非推理模型），映射表按字段剔除 undefined。 */
function reasoningEffortsOf(model: EnterpriseBootstrapModel): false | PiAiReasoningEfforts | undefined {
  if (model.reasoningEfforts === false) return false
  if (model.reasoningEfforts === undefined) return undefined
  const kept = pruneUndefined(model.reasoningEfforts)
  return kept === undefined ? undefined : (kept as PiAiReasoningEfforts)
}

/** compat 只保留 pi-ai 认得的开关；未知 thinkingFormat 丢弃而非透传。 */
function compatOf(model: EnterpriseBootstrapModel): PiAiCompatProfile | undefined {
  if (model.compat === undefined) return undefined
  const kept = pruneUndefined(model.compat)
  if (kept === undefined) return undefined
  const format = kept.thinkingFormat
  if (typeof format === 'string' && !THINKING_FORMATS.has(format)) delete kept.thinkingFormat
  return Object.keys(kept).length === 0 ? undefined : (kept as PiAiCompatProfile)
}

/**
 * 单个模型的 profile。`id`/`name` 缺省取 alias/name；
 * 未声明的容量与开关一律不落字段（官方 pi-ai 会用自己的目录缺省补齐）。
 */
function modelProfile(
  model: EnterpriseBootstrapModel,
  id: string = model.alias,
  name: string = model.name ?? model.alias,
): PiAiModelProfile {
  const reasoningEfforts = reasoningEffortsOf(model)
  const compat = compatOf(model)
  return {
    id,
    name,
    input: ['text'],
    ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
    ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
    ...(reasoningEfforts === undefined ? {} : { reasoningEfforts }),
    ...(compat === undefined ? {} : { compat }),
  }
}

/** 同一协议的一组模型共用一个 route；authorization 是代理占位值，真实令牌由 platform 逐请求注入。 */
function providerProfile(
  api: EnterpriseApiProtocol,
  baseURL: string,
  authorization: string,
  displayName: string,
  models: PiAiModelProfile[],
): PiAiProviderProfile {
  // Anthropic SDK 自行补齐 /v1/messages；OpenAI 系 SDK 要求 baseURL 已经带 /v1。
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
 * 把一次脱敏 bootstrap 快照投影为官方 pi-ai 的完整 route 配置。
 * 纯函数：同一 (snapshot, baseURL, authorization) 永远产出同一字典，register 的 JSON 指纹依赖这一点。
 */
export function buildEnterpriseProfiles(
  snapshot: EnterpriseBootstrapSnapshot | undefined,
  baseURL: string,
  authorization: string,
): EnterpriseProfiles {
  if (snapshot === undefined) return {}
  const models = snapshot.models ?? []
  const profiles: EnterpriseProfiles = {}
  for (const api of PROTOCOLS) {
    const grouped = models
      .filter(model => model.apiProtocol === api)
      .map(model => modelProfile(model))
    if (grouped.length === 0) continue
    profiles[routeName(api)] = providerProfile(api, baseURL, authorization, DISPLAY_NAMES[api], grouped)
  }
  const selected = models.find(model => model.isDefault)
  if (selected !== undefined) {
    profiles[ENTERPRISE_PROVIDER] = providerProfile(
      selected.apiProtocol,
      baseURL,
      authorization,
      DEFAULT_DISPLAY_NAME,
      [modelProfile(selected, ENTERPRISE_DEFAULT_MODEL, `${selected.name ?? selected.alias}（企业默认）`)],
    )
  }
  return profiles
}
