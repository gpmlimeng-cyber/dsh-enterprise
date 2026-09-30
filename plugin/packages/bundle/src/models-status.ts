/**
 * [INPUT]: 依赖 `WebServerRoutePort`、平台 Service 的 `bootstrap()` 只读副本与 `ctx` 的 `configEditor`（Loader entry 表）
 * [OUTPUT]: 对外提供 `registerEnterpriseModelsStatusRoute` —— `GET /enterprise/api/v1/local/models/status` 返回企业模型挂载链的可见状态
 * [POS]: bundle 的诊断面（只读、无令牌、浏览器可读）。App 把 Host 日志指向 /dev/null，企业模型不显示时没有日志可查，故把断点状态直接投影出来
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { type WebServerRoutePort } from '@dshent/platform-client'

/** 本地只读状态路由。 */
export const ENTERPRISE_MODELS_STATUS_PATH = '/enterprise/api/v1/local/models/status'

const PI_AI_RUNTIME_NAME = 'llm-pi-ai'
const PI_AI_PACKAGE_NAME = '@deepseek-ai/dsh-llm-pi-ai'
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 平台 Service 的最小子集：只要 bootstrap 快照。结构化类型，不引重依赖。 */
export interface ModelsStatusPlatformPort {
  bootstrap(): { readonly models?: readonly { readonly apiProtocol?: unknown }[] } | undefined
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

/** Loader entry 的最小子集（定位官方 pi-ai 行用）。 */
interface EntryLike {
  readonly options: { readonly name?: unknown; readonly config?: unknown }
  readonly fiber?: { readonly runtime?: { readonly name?: unknown } } | undefined
}

function findPiAiEntry(ctx: Context): EntryLike | undefined {
  const editor = ctx.get('configEditor') as { readonly entries?: () => readonly EntryLike[] } | undefined
  if (editor === undefined || typeof editor.entries !== 'function') return undefined
  return editor.entries().find(row =>
    row.fiber?.runtime?.name === PI_AI_RUNTIME_NAME || row.options.name === PI_AI_PACKAGE_NAME)
}

/** 从 entry config 里读出 providers 键（读不到返回空数组，不抛错）。 */
function providerKeys(entry: EntryLike | undefined): readonly string[] {
  const config = entry?.options.config
  if (config === null || config === undefined || typeof config !== 'object') return []
  const providers = (config as Record<string, unknown>).providers
  if (providers === null || providers === undefined || typeof providers !== 'object') return []
  return Object.keys(providers)
}

/**
 * 注册企业模型挂载状态路由。
 *
 * 只读投影三件事：①平台 bootstrap 快照是否就位与模型数 ②官方 pi-ai 行是否定位到
 * ③企业 route 是否真的写进了 `providers`。Host 日志不落盘时，凭这三件事即可定位断点。
 *
 * @param webServer - bundle 顶层注入的路由端口。
 * @param ctx - bundle 组合根上下文（读 `configEditor`）。
 * @param platform - 平台 Service（只读 `bootstrap()`）。
 * @param onError - 判定点日志出口。
 * @returns 路由注销器。
 */
export function registerEnterpriseModelsStatusRoute(
  webServer: WebServerRoutePort,
  ctx: Context,
  platform: ModelsStatusPlatformPort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_MODELS_STATUS_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      try {
        const snapshot = platform.bootstrap()
        const models = snapshot?.models ?? []
        const entry = findPiAiEntry(ctx)
        const providers = providerKeys(entry)
        const protocols = [...new Set(models
          .map(model => model.apiProtocol)
          .filter((value): value is string => typeof value === 'string'))]
        writeJson(response, 200, {
          data: {
            bootstrap: snapshot === undefined ? 'missing' : 'ready',
            modelCount: models.length,
            apiProtocols: protocols,
            piAiEntryFound: entry !== undefined,
            providers,
            enterpriseProviders: providers.filter(key => key.startsWith('enterprise')),
          },
        })
      } catch (error) {
        onError?.(`enterprise models status projection failed`
          + ` [operation=GET ${ENTERPRISE_MODELS_STATUS_PATH} step=project-threw]`, error)
        writeJson(response, 503, { error: { code: 'ENT_PLATFORM_UNAVAILABLE' } })
      }
    },
  })
}
