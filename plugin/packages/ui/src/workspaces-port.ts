/**
 * [INPUT]: 依赖官方客户端 `ctx.workspaces` 服务的原生选目录/登记工作区/请求开会话能力。
 * [OUTPUT]: 对外提供 OfficialWorkspacesPort 与按需读取器 createOfficialWorkspacesReader（缺失时返回 undefined）。
 * [POS]: ui 与官方客户端运行时之间的可选边界；不硬声明 client-runtime 依赖，缺失即让调用方降级。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 官方工作区视图的最小投影；只取登记与会话请求需要的事实。 */
export interface OfficialWorkspaceView {
  readonly workspaceId: string
}

/**
 * 官方 `ctx.workspaces` 的窄接口。
 * 只声明云端项目用得上的三个动作，避免绑死官方接口宽度。
 */
export interface OfficialWorkspacesPort {
  /** 打开 Host 的原生目录选择器；用户取消返回 null。 */
  pickDirectory(): Promise<string | null>
  /** 把一个已存在的绝对路径登记为原生工作区（幂等）。 */
  create(input: { readonly path: string }): Promise<OfficialWorkspaceView>
  /**
   * 请求打开该工作区的会话。
   * 官方实现返回 void 且自行吞掉失败（仅告警），因此这里只表示「已发起」，
   * 调用方不得据此宣称会话已成功打开。
   */
  requestSession(workspaceId: string): boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 工作区标识字段名在不同官方版本间存在差异（`workspaceId` 为官方契约名，
 * 部分版本/投影使用 `id`），这里只接受非空字符串，二者取先出现者。
 */
function readWorkspaceId(view: Record<string, unknown>): string | undefined {
  for (const key of ['workspaceId', 'id']) {
    const candidate = view[key]
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/** 从上下文解析官方工作区服务；任一必需能力缺失即返回 undefined。 */
function resolve(ctx: unknown): OfficialWorkspacesPort | undefined {
  if (!isRecord(ctx) || typeof ctx['get'] !== 'function') return undefined
  const candidate = (ctx['get'] as (name: string) => unknown)('workspaces')
  if (!isRecord(candidate)) return undefined
  const { pickDirectory, create, startSession } = candidate as {
    pickDirectory?: unknown
    create?: unknown
    startSession?: unknown
  }
  if (typeof pickDirectory !== 'function' || typeof create !== 'function') return undefined
  return {
    pickDirectory: () => Promise.resolve().then(
      () => (pickDirectory as () => Promise<string | null>).call(candidate),
    ),
    create: async input => {
      const view = await Promise.resolve().then(
        () => (create as (input: { path: string }) => Promise<unknown>).call(candidate, { path: input.path }),
      )
      const workspaceId = isRecord(view) ? readWorkspaceId(view) : undefined
      if (workspaceId === undefined) {
        throw new Error('official workspace create returned no workspace id')
      }
      return { workspaceId }
    },
    requestSession: workspaceId => {
      if (typeof startSession !== 'function') return false
      try {
        ;(startSession as (workspaceId?: string) => void).call(candidate, workspaceId)
        return true
      } catch {
        return false
      }
    },
  }
}

/**
 * 每次调用都重新读取官方服务。
 * cordis 的 `get` 只在提供方 fiber 处于活动态时返回实例，一次性缓存会在
 * 启动次序不保证时永久失效；按需读取让调用方始终看到当前事实。
 */
export function createOfficialWorkspacesReader(ctx: unknown): () => OfficialWorkspacesPort | undefined {
  return () => resolve(ctx)
}

/** 单次读取便捷入口（测试与一次性调用使用）。 */
export function readOfficialWorkspaces(ctx: unknown): OfficialWorkspacesPort | undefined {
  return resolve(ctx)
}
