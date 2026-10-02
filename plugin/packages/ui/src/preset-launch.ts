/**
 * [INPUT]: 只依赖注入的官方客户端**结构面**（`uiWorkspace.openWorkspace` 的第二参 `beforeOpen`、`workspaces`/`sessions` 两个快照读口、`conversation.input.shell(id).actions.setDraft`），**不 import 任何 `@deepseek-ai/*`**、不发网络请求、不认识任何企业 DTO
 * [OUTPUT]: 对外提供 `EnterprisePresetLaunchPort`（降级链第二级的唯一端口形状）、`EnterprisePresetSessionPorts`（四个官方结构面）、`enterprisePresetWorkspaceOrder`（工作区落点的**纯**排序投影）与 `enterprisePresetSessionPortsFrom`（把「运行时读到的一把服务」收窄成端口；任一环缺席即 undefined = 这一级不可用）
 * [POS]: ui 的**降级链第二级**唯一实现——「跳到新会话并把导入指令填进输入框（用户只需按发送）」。它刻意只吃**结构**：官方那两件服务在别的包里、版本可能不同，故这里不 import 它们的类型，只用可选链 + 形状校验；真接线在 `client.tsx`（`ctx.get('uiWorkspace')` 等），假接线在 `tests/preset-launch.spec.ts`。
 * [EVIDENCE]: 这一级的官方机制**已逐条查实**（不是猜的），全部是「包名 + 文件:行号」：
 *   · `@deepseek-ai/dsh-client-ui-workspace/lib/types/client/navigation.d.ts:25` —— `openWorkspace(workspaceId, beforeOpen?)`（第二参就是 `beforeOpen`，文档在 `:16-24`）；
 *   · `@deepseek-ai/dsh-client-ui-workspace/lib/client.js:643-657` —— 实现：`connectWorkspace` 之后 `replaceMain(sessionId, …, beforeOpen)`；
 *   · `@deepseek-ai/dsh-client-ui-workspace/lib/client.js:793-798` —— `beforeOpen(reference.sessionId)` 在**选定/打开之前同步**被调，故 `sessionId` 拿得到；
 *   · `@deepseek-ai/dsh-client-ui-workspace/lib/client.js:618-627` —— `reuseOrCreateBlank`：落点是**空白**会话（复用空白的那条，没有才新建）；
 *   · `@deepseek-ai/dsh-client-ui-workspace/lib/client.js:826-842` —— `recentWorkspace`（本文件 `enterprisePresetWorkspaceOrder` 的镜像真源）；
 *   · `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/input/hub.d.ts:39` —— `shell(id: SessionId): SessionInputShell`；
 *   · `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/input/facade.d.ts:72`（`readonly actions: InputActions`）与 `:106`（shell 直取 `setDraft`）；`…/contract/input.d.ts:217`（`InputActions.setDraft`）；
 *   · `@deepseek-ai/dsh-client-ui-conversation/lib/client.js:3201-3202` —— 服务名 `conversation`、`.input` 即 `InputHub`；`:13926-13930` —— `shell(id)` 实现（无 binding 即抛，故本文件不吞异常、整级如实失败）；
 *   · `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/input/facade.d.ts:247-255` —— 「先 `setDraft` 再 bind」是官方写明的用法。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 降级链第二级的端口：把一句导入指令交给官方「新建会话 + 填入输入框」的链路。
 *
 * 返回 `true` = 已经打开了一个**空白/新**会话，并确实把这句指令交给了官方输入面板的写入口
 * （**不发送**，用户只需按发送）；`false` / reject = 这一级没走成，界面如实说一句人话 + 稳定码
 * （绝不静默降级、也绝不假装成功）。
 *
 * ⚠️ 注意 `true` 的口径：官方 `setDraft(text): void` 没有返回值，故它**不承诺**「文本一定渲染出来了」，
 * 只承诺「会话已打开 + 官方那枚写入口被调到」。
 */
export type EnterprisePresetLaunchPort = (instruction: string) => Promise<boolean>

/** 官方那一侧我们真正用到的四个结构面（全部可选；任一环缺席即这一级不可用）。 */
export interface EnterprisePresetSessionPorts {
  /** 官方 `@deepseek-ai/dsh-client-ui-workspace` 的 `UiWorkspace.openWorkspace`。 */
  readonly openWorkspace: (workspaceId: string, beforeOpen: (sessionId: string) => void) => Promise<void>
  /** 候选工作区（已按最近使用排序，首个即落点）；空数组即没有可落的会话容器。 */
  readonly targetWorkspaceIds: () => readonly string[]
  /**
   * 官方 `@deepseek-ai/dsh-client-ui-conversation` 的
   * `conversation.input.shell(id).actions.setDraft(text)`；返回是否**真的调到了**那一枚官方写入口。
   *
   * **不是**「官方保证写成功了」：官方契约 `InputActions.setDraft(text: string): void` 无返回值
   * （`contract/input.d.ts:217`），故这里只能说「我们确实把文本交给了官方那枚函数」。
   * 拿到 `false` 的唯一含义是「这一环的形状不对」——那时整级不可用、界面如实降级。
   */
  readonly setDraft: (sessionId: string, text: string) => boolean
}

/** `workspaces.list.getSnapshot()` 里我们真正要用的两个事实。 */
export interface EnterprisePresetWorkspacesSnapshot {
  readonly items: readonly {
    readonly workspaceId: string
    readonly createdAt: string
    readonly sessionIds: readonly string[]
  }[]
}

/** `sessions.list.getSnapshot()` 里我们真正要用的一个事实。 */
export interface EnterprisePresetSessionsSnapshot {
  readonly byId: Readonly<Record<string, { readonly updatedAt?: string } | undefined>>
}

/** 结构收窄：不是对象就 undefined（绝不 `as` 一个陌生形状然后崩在别人身上）。 */
function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/**
 * 工作区落点的**纯**排序投影（镜像官方 `startSession(undefined)` 的「最近工作区」口径）。
 *
 * 官方原话（`@deepseek-ai/dsh-client-ui-workspace/lib/client.js:826-842` 的 `recentWorkspace`，
 * 由同文件 `:671` 的 `startSession` 消费）：
 * 每个工作区取「它名下会话里最新的 `updatedAt`」，一个都没有就退到工作区自己的 `createdAt`，
 * 取最大的那个。这里原样复刻，故「在新会话里打开」落在的位置与用户按侧栏「新建会话」一致。
 *
 * @param workspaces - `workspaces.list.getSnapshot()`。
 * @param sessions - `sessions.list.getSnapshot()`（缺席即全部退到工作区的 `createdAt`）。
 * @returns 工作区 id，按最近使用降序；输入不可用时是空数组。
 */
export function enterprisePresetWorkspaceOrder(
  workspaces: unknown,
  sessions: unknown,
): readonly string[] {
  const items = Array.isArray(recordOf(workspaces)?.['items']) ? recordOf(workspaces)!['items'] as readonly unknown[] : []
  const byId = recordOf(recordOf(sessions)?.['byId'])
  const scored: { readonly id: string; readonly at: number }[] = []
  for (const item of items) {
    const row = recordOf(item)
    if (row === undefined) continue
    const id = row['workspaceId']
    if (typeof id !== 'string' || id === '') continue
    const sessionIds = Array.isArray(row['sessionIds']) ? row['sessionIds'] as readonly unknown[] : []
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of sessionIds) {
      if (typeof sessionId !== 'string') continue
      const updatedAt = recordOf(byId?.[sessionId])?.['updatedAt']
      if (typeof updatedAt !== 'string') continue
      const parsed = Date.parse(updatedAt)
      if (Number.isFinite(parsed)) latest = Math.max(latest, parsed)
    }
    if (!Number.isFinite(latest)) {
      const created = typeof row['createdAt'] === 'string' ? Date.parse(row['createdAt'] as string) : Number.NaN
      latest = Number.isFinite(created) ? created : Number.NEGATIVE_INFINITY
    }
    scored.push({ id, at: latest })
  }
  return scored.sort((left, right) => right.at - left.at).map(item => item.id)
}

/**
 * 把「运行时读到的一把官方服务」收窄成降级链第二级的端口。
 *
 * 逐环校验（缺一环就整条不可用，返回 undefined）：
 *   ① `uiWorkspace.openWorkspace` 必须是函数（第二参就是我们拿 `sessionId` 的唯一接缝）；
 *   ② `workspaces.list.getSnapshot` 与 `sessions.list.getSnapshot` 必须是函数（算落点用）；
 *   ③ `conversation.input.shell(id)` 必须返回对象，且它的 `actions.setDraft` 是函数。
 *
 * **刻意不 import 官方类型**：这三件服务分属三个包，本仓的 peer/pin 与运行时版本不必一致；
 * 形状不认识时这一级就是**不可用**（降级链如实说明并落到第三级），绝不猜测。
 */
export function enterprisePresetSessionPortsFrom(services: {
  readonly uiWorkspace: unknown
  readonly workspaces: unknown
  readonly sessions: unknown
  readonly conversation: unknown
}): EnterprisePresetSessionPorts | undefined {
  const openWorkspace = recordOf(services.uiWorkspace)?.['openWorkspace']
  if (typeof openWorkspace !== 'function') return undefined
  const workspaceSnapshot = recordOf(recordOf(services.workspaces)?.['list'])?.['getSnapshot']
  const sessionSnapshot = recordOf(recordOf(services.sessions)?.['list'])?.['getSnapshot']
  if (typeof workspaceSnapshot !== 'function' || typeof sessionSnapshot !== 'function') return undefined
  const shell = recordOf(recordOf(services.conversation)?.['input'])?.['shell']
  if (typeof shell !== 'function') return undefined
  return {
    openWorkspace: (workspaceId, beforeOpen) =>
      (openWorkspace as (w: string, b: (id: string) => void) => Promise<void>).call(services.uiWorkspace, workspaceId, beforeOpen),
    targetWorkspaceIds: () => enterprisePresetWorkspaceOrder(
      (workspaceSnapshot as () => unknown).call(recordOf(services.workspaces)!['list']),
      (sessionSnapshot as () => unknown).call(recordOf(services.sessions)!['list']),
    ),
    setDraft: (sessionId, text) => {
      // `conversation.input.shell(id)` 是官方的「按 id 直取输入面板」服务面
      // （声明 `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/input/hub.d.ts:39`，
      //  实现同名包 `lib/client.js:13926-13930`；`InputHub` 由 `ConversationController` 构造注入，
      //  服务名 `conversation` + `.input`：`lib/client.js:3201-3202`）。
      // 它返回的 `SessionInputShell.actions` 就是**发给每个会话级 slot 组件**的那一份
      // `InputActions`（`lib/types/client/input/facade.d.ts:72`；`setDraft` 在
      // `lib/types/client/contract/input.d.ts:217`，另有等价的 shell 直取口 `facade.d.ts:106`）。
      //
      // ⚠️ 两个诚实边界（都不在这里假装成功）：
      //  · 官方 `shell(id)` 在**该会话没有 binding 时抛错**（`lib/client.js:13928`）——这一抛会经
      //    `beforeOpen` 冒到 `replaceMain` 的 catch（`lib/client.js:796-811` → 回收引用后重抛），
      //    官方据此**中止整次打开**（`navigation.d.ts:19-21`：「a throw aborts the open」）；
      //    我们不吞它，于是整级如实失败（`createEnterprisePresetLauncher` 的 catch → `false`），
      //    界面给 `ENT_PRESET_LAUNCH_FAILED` 并落到第三级——**不留一个开了却没填指令的会话**。
      //  · 官方 `setDraft` 无返回值，故 `true` 只表示「确实调到了那一枚官方写入口」，不表示官方保证写成。
      const resolved = (shell as (id: string) => unknown).call(recordOf(services.conversation)!['input'], sessionId)
      const setDraft = recordOf(recordOf(resolved)?.['actions'])?.['setDraft']
      if (typeof setDraft !== 'function') return false
      ;(setDraft as (text: string) => void).call(recordOf(resolved)!['actions'], text)
      return true
    },
  }
}

/**
 * 建降级链第二级那枚端口。
 *
 * @param read - 每次点击时**重新读一次**服务（服务挂载晚于本插件时也照常可用）；返回 undefined 即这一级不可用。
 * @returns 端口：`true` = 已打开（复用空白或新建的）会话，并确实把这句指令交给了官方输入面板的写入口
 *   （**不发送**，用户只需按发送）；`false`/reject = 这一级没走成，界面如实说一句人话 + 稳定码。
 */
export function createEnterprisePresetLauncher(
  read: () => EnterprisePresetSessionPorts | undefined,
): EnterprisePresetLaunchPort {
  return async (instruction) => {
    const ports = read()
    if (ports === undefined) return false
    const workspaceId = ports.targetWorkspaceIds()[0]
    if (workspaceId === undefined) return false
    let filled = false
    try {
      // 官方 `UiWorkspace.openWorkspace(workspaceId, beforeOpen)`：`beforeOpen` 在会话选定后、
      // 打开之前**同步**回调 sessionId（声明 `@deepseek-ai/dsh-client-ui-workspace/lib/types/client/navigation.d.ts:25`
      // ——`beforeOpen` 是第二参；实现 `lib/client.js:643-657`：`connectWorkspace` 之后
      // `replaceMain(sessionId, …, beforeOpen)`，而 `replaceMain` 在 `lib/client.js:798` 同步调它、
      // 该调用在 `lib/client.js:796-811` 的 catch 里（抛出即回收引用并重抛，官方据此中止打开））。
      // 因此这里能把草稿写进**即将打开的那个会话**的输入框——这就是「用户只需按发送」。
      //
      // 落点一定是**空白/新**会话而不是某个有内容的会话：`connectWorkspace` 走
      // `reuseOrCreateBlank`（`lib/client.js:618-627`）——复用该工作区里**空白**的那条，没有就新建。
      //
      // 「先写草稿、后挂载输入框」是官方支持的顺序，不是我们钻空子：
      // `SessionInputShell.bindMirror` 的契约原文（`…/input/facade.d.ts:247-255`）写着
      // 「the caller seeds it via setDraft BEFORE binding」。
      await ports.openWorkspace(workspaceId, (sessionId) => {
        filled = ports.setDraft(sessionId, instruction)
      })
    } catch {
      return false
    }
    return filled
  }
}
