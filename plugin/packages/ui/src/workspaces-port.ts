/**
 * [INPUT]: 依赖官方客户端 `ctx.workspaces` 服务的原生选目录/登记工作区/开会话能力。
 * [OUTPUT]: 对外提供 OfficialWorkspacesPort 与安全读取器 readOfficialWorkspaces（缺失时返回 undefined）。
 * [POS]: ui 与官方客户端运行时之间的可选边界；不硬声明 client-runtime 依赖，缺失即让调用方降级。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 官方工作区视图的最小投影；只取登记与开会话需要的事实。 */
export interface OfficialWorkspaceView {
  readonly id: string
}

/**
 * 官方 `ctx.workspaces` 的窄接口。
 * 只声明云端项目用得上的四个动作，避免绑死官方接口宽度。
 */
export interface OfficialWorkspacesPort {
  /** 打开 Host 的原生目录选择器；用户取消返回 null。 */
  pickDirectory(): Promise<string | null>
  /** 把一个已存在的绝对路径登记为原生工作区（幂等）。 */
  create(input: { readonly path: string }): Promise<OfficialWorkspaceView>
  /** 进入该工作区的会话；官方实现允许省略工作区而沿用当前/最近。 */
  startSession(workspaceId?: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 从 Cordis 上下文读取官方工作区服务。
 * 任一必需能力缺失即返回 undefined，让调用方回到手动填写目录的降级路径；
 * 这样客户端运行时不提供该服务（含未来行退役）也不会让插件失效。
 */
export function readOfficialWorkspaces(ctx: unknown): OfficialWorkspacesPort | undefined {
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
      if (!isRecord(view) || typeof view['id'] !== 'string' || view['id'].length === 0) {
        throw new Error('official workspace create returned no id')
      }
      return { id: view['id'] }
    },
    startSession: workspaceId => {
      if (typeof startSession !== 'function') return
      ;(startSession as (workspaceId?: string) => void).call(candidate, workspaceId)
    },
  }
}
