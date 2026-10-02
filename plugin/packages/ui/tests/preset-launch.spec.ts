/**
 * [INPUT]: 依赖 preset-launch 的三个出口（`enterprisePresetWorkspaceOrder` / `enterprisePresetSessionPortsFrom` / `createEnterprisePresetLauncher`）与 marketplace-entry 的降级链文案；全部用**结构 double**，不碰真官方包
 * [OUTPUT]: 降级链第二级（「跳到新会话并把导入指令填进输入框，用户只需按发送」）的机械门禁：① 工作区落点与官方 `startSession(undefined)` 的「最近工作区」口径逐条一致（会话最新 updatedAt 优先、退到工作区 createdAt、非法形状不崩）；② 四个官方结构面任一环缺席即**整级不可用**（返回 undefined，不猜、不 `as`）；③ 端口真的把指令写进**新会话**的输入框（`openWorkspace` 的第二参拿到 sessionId → `shell(id).actions.setDraft(text)`），且**绝不发送**（只调 setDraft，不调 submit）；④ 任一步失败返回 false（界面据此出稳定码 + 下一步），且每一级切换都有可见说明
 * [POS]: ui 降级链第二级的唯一取证点（真接线在 client.tsx，官方三件服务在别的包里、本仓测不到真服务）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_PRESET_FALLBACK_LEVELS,
  ENTERPRISE_PRESET_NEW_SESSION_TEXT,
  enterprisePresetClipboardReason,
  enterprisePresetFallbackPlan,
  enterprisePresetNewSessionReason,
} from '../src/marketplace-entry.js'
import {
  createEnterprisePresetLauncher,
  enterprisePresetSessionPortsFrom,
  enterprisePresetWorkspaceOrder,
} from '../src/preset-launch.js'

// 只读降级链的文案与纯投影：官方原语整包 mock 掉（与其余 spec 同款），不为一次文案断言拉进整条组件依赖。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

/** 一份合法的 `workspaces.list.getSnapshot()` 形状。 */
const WORKSPACES = {
  items: [
    { workspaceId: 'ws-old', createdAt: '2026-01-01T00:00:00Z', sessionIds: ['s1'] },
    { workspaceId: 'ws-new', createdAt: '2026-02-01T00:00:00Z', sessionIds: ['s2'] },
    { workspaceId: 'ws-empty', createdAt: '2026-09-01T00:00:00Z', sessionIds: [] },
  ],
}

/** 一份合法的 `sessions.list.getSnapshot()` 形状。 */
const SESSIONS = { byId: { s1: { updatedAt: '2026-03-01T00:00:00Z' }, s2: { updatedAt: '2026-08-01T00:00:00Z' } } }

describe('降级链：三级与可见说明', () => {
  it('stays on level ① whenever one-click is available (no fallback note at all)', () => {
    const plan = enterprisePresetFallbackPlan({ oneClickAvailable: true, newSessionAvailable: true, clipboardAvailable: true })
    expect(plan.level).toBe('one-click')
    expect(plan.reason).toBeUndefined()
    expect(plan.note).toBeUndefined()
  })

  it('walks ① → ② → ③ in order and always explains why', () => {
    const second = enterprisePresetFallbackPlan({
      oneClickAvailable: false,
      oneClickReason: '这台设备上的入口还没接通',
      newSessionAvailable: true,
      clipboardAvailable: true,
    })
    expect(second.level).toBe('new-session')
    expect(second.note).toBe(enterprisePresetNewSessionReason('这台设备上的入口还没接通'))
    expect(second.note).toContain('一键启用暂时不可用')
    expect(second.note).toContain('只需按发送')

    const third = enterprisePresetFallbackPlan({
      oneClickAvailable: false,
      oneClickReason: '这台设备上的入口还没接通',
      newSessionAvailable: false,
      clipboardAvailable: true,
    })
    expect(third.level).toBe('clipboard')
    expect(third.note).toBe(enterprisePresetClipboardReason('这台设备上的入口还没接通'))
    expect(third.note).toContain('一键启用与新建会话都不可用')

    // 三级全不可用：仍然有一句显式说明（绝不留白）。
    const none = enterprisePresetFallbackPlan({ oneClickAvailable: false, newSessionAvailable: false, clipboardAvailable: false })
    expect(none.note).toBeDefined()
    expect(none.note).toContain('请联系企业管理员')

    // 缺原因时也有兜底人话（不出现 `undefined`）。
    const noReason = enterprisePresetFallbackPlan({ oneClickAvailable: false, newSessionAvailable: true, clipboardAvailable: false })
    expect(noReason.reason).toBe('当前版本暂不支持在这台设备上一键启用')
    expect(noReason.note).not.toContain('undefined')

    // 三级的顺序真源就是这三个成员（① 最优）。
    expect(ENTERPRISE_PRESET_FALLBACK_LEVELS).toEqual(['one-click', 'new-session', 'clipboard'])
    expect(ENTERPRISE_PRESET_NEW_SESSION_TEXT).toBe('在新会话里打开')
  })
})

describe('降级链第二级：工作区落点（镜像官方 startSession 的最近工作区口径）', () => {
  it('orders by the newest updatedAt among a workspace\'s sessions, then by createdAt', () => {
    // ws-new 名下会话最新（2026-08）> ws-empty 的 createdAt（2026-09）… 故 ws-empty 第一。
    expect(enterprisePresetWorkspaceOrder(WORKSPACES, SESSIONS)).toEqual(['ws-empty', 'ws-new', 'ws-old'])
    // 没有会话快照时全部退到工作区自己的 createdAt。
    expect(enterprisePresetWorkspaceOrder(WORKSPACES, undefined)).toEqual(['ws-empty', 'ws-new', 'ws-old'])
    // 会话更新时间让 ws-old 翻上来（同一个工作区取它名下**最新**那条）。
    expect(enterprisePresetWorkspaceOrder(WORKSPACES, { byId: { s1: { updatedAt: '2027-01-01T00:00:00Z' } } })[0]).toBe('ws-old')
  })

  it('never throws on malformed snapshots (unknown shapes degrade to "no workspace")', () => {
    for (const bad of [undefined, null, 'x', 7, [], { items: 'oops' }, { items: [null, 3, {}] }]) {
      expect(() => enterprisePresetWorkspaceOrder(bad, bad)).not.toThrow()
    }
    expect(enterprisePresetWorkspaceOrder(undefined, undefined)).toEqual([])
    expect(enterprisePresetWorkspaceOrder({ items: [{ workspaceId: '', createdAt: 'x', sessionIds: [] }] }, undefined)).toEqual([])
  })
})

describe('降级链第二级：官方结构面的收窄与真写草稿', () => {
  /** 一把「像官方那样」的服务 double；`shell` 记录被写入的草稿。 */
  function services(overrides: Record<string, unknown> = {}) {
    const drafts: { sessionId: string; text: string }[] = []
    const opens: { workspaceId: string; sessionId: string }[] = []
    const base = {
      uiWorkspace: {
        openWorkspace: async (workspaceId: string, beforeOpen?: (sessionId: string) => void) => {
          const sessionId = `new-${workspaceId}`
          beforeOpen?.(sessionId)
          opens.push({ workspaceId, sessionId })
        },
      },
      workspaces: { list: { getSnapshot: () => WORKSPACES } },
      sessions: { list: { getSnapshot: () => SESSIONS } },
      conversation: {
        input: {
          shell: (sessionId: string) => ({
            actions: {
              setDraft: (text: string) => { drafts.push({ sessionId, text }) },
              // 官方那一份 `InputActions` 里也有 `submit`；**降级链第二级绝不许调它**。
              submit: vi.fn(),
            },
          }),
        },
      },
      ...overrides,
    }
    return { base, drafts, opens }
  }

  it('narrows the live services into ports and fills the NEW session draft without sending', async () => {
    const { base, drafts, opens } = services()
    const ports = enterprisePresetSessionPortsFrom(base)
    expect(ports).toBeDefined()
    const launch = createEnterprisePresetLauncher(() => ports)
    await expect(launch('导入这条配方')).resolves.toBe(true)
    // 落点是最近工作区（ws-empty），会话 id 由官方 openWorkspace 的第二参交回。
    expect(opens).toEqual([{ workspaceId: 'ws-empty', sessionId: 'new-ws-empty' }])
    // 指令被写进**那个新会话**的输入框，且只调 setDraft（没有 submit ⇒ 用户只需按发送）。
    expect(drafts).toEqual([{ sessionId: 'new-ws-empty', text: '导入这条配方' }])
    const shell = base.conversation.input.shell('x')
    expect(vi.mocked(shell.actions.submit)).not.toHaveBeenCalled()
  })

  it('returns undefined (level ② unavailable) when any of the four official faces is missing', () => {
    for (const missing of ['uiWorkspace', 'workspaces', 'sessions', 'conversation']) {
      const { base } = services({ [missing]: undefined })
      expect(enterprisePresetSessionPortsFrom(base), missing).toBeUndefined()
    }
    // 形状对但缺那一层方法：同样整级不可用（绝不猜、不 `as`）。
    expect(enterprisePresetSessionPortsFrom(services({ uiWorkspace: {} }).base)).toBeUndefined()
    expect(enterprisePresetSessionPortsFrom(services({ workspaces: { list: {} } }).base)).toBeUndefined()
    expect(enterprisePresetSessionPortsFrom(services({ conversation: { input: {} } }).base)).toBeUndefined()
    // `shell(id)` 存在、但它回传的 `actions` 里没有 `setDraft`：那一环要等真的拿到 sessionId 才看得见，
    // 故收窄这一步只验到 `shell` 是函数；真正的拒绝发生在写入那一刻（下一条用例逐条取证）。
    expect(enterprisePresetSessionPortsFrom(services({ conversation: { input: { shell: () => ({}) } } }).base)).toBeDefined()
    expect(enterprisePresetSessionPortsFrom({ uiWorkspace: undefined, workspaces: undefined, sessions: undefined, conversation: undefined }))
      .toBeUndefined()
  })

  it('returns false when there is no workspace, when setDraft refuses, or when openWorkspace throws', async () => {
    // 没有可落的工作区。
    const empty = services({ workspaces: { list: { getSnapshot: () => ({ items: [] }) } } })
    const emptyPorts = enterprisePresetSessionPortsFrom(empty.base)
    await expect(createEnterprisePresetLauncher(() => emptyPorts)('x')).resolves.toBe(false)

    // 官方输入面板拒绝写入（`setDraft` 不存在 / 抛错）。
    const noDraft = services({ conversation: { input: { shell: () => ({ actions: {} }) } } })
    await expect(createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(noDraft.base))('x')).resolves.toBe(false)

    // 新建会话本身抛错（离线 / Host 拒绝）。
    const broken = services({ uiWorkspace: { openWorkspace: async () => { throw new Error('workspace/create-failed') } } })
    await expect(createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(broken.base))('x')).resolves.toBe(false)

    // 服务读取回调返回 undefined（服务晚挂载 / 已被卸载）。
    await expect(createEnterprisePresetLauncher(() => undefined)('x')).resolves.toBe(false)
  })

  it('aborts the open (and reports failure) when the official input panel throws — never a half-done session', async () => {
    // 官方 `shell(id)` 在「该会话没有 binding」时**抛错**（`lib/client.js:13928`），而 `beforeOpen` 抛错会让
    // 官方 `replaceMain` 回收引用并重抛、**中止整次打开**（`navigation.d.ts:19-21`、`client.js:796-811`）。
    // 这里用同构的 double 取证：我们不吞这一抛 ⇒ 整级返回 false（界面出 ENT_PRESET_LAUNCH_FAILED 并降到第三级），
    // 而不是留下一个「会话开了、指令没进去」的半成品。
    let opened = false
    const throwing = services({
      uiWorkspace: {
        openWorkspace: async (workspaceId: string, beforeOpen?: (sessionId: string) => void) => {
          const sessionId = `new-${workspaceId}`
          try {
            beforeOpen?.(sessionId)
          } catch (error) {
            // 官方那一侧的行为：抛出即不打开（这里如实复刻，会话没有被「打开」）。
            throw error
          }
          opened = true
        },
      },
      conversation: {
        input: { shell: () => { throw new Error('conversation.input: session resolved no binding') } },
      },
    })
    await expect(createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(throwing.base))('导入这条配方'))
      .resolves.toBe(false)
    expect(opened).toBe(false)

    // `setDraft` 本身抛错（形状对、运行时拒绝）同理：整级失败，不留半成品。
    const draftThrows = services({ conversation: { input: { shell: () => ({ actions: { setDraft: () => { throw new Error('editor disposed') } } }) } } })
    await expect(createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(draftThrows.base))('x')).resolves.toBe(false)

    // 反向对照：形状不认识（`shell` 回的 `actions` 里没有 `setDraft`）不抛，只是这一环返回 false ⇒ 整级 false。
    const shapeOnly = services({ conversation: { input: { shell: () => ({ actions: { submit: vi.fn() } }) } } })
    await expect(createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(shapeOnly.base))('x')).resolves.toBe(false)
  })

  it('reads the services lazily on every click (a plugin mounted later still works)', async () => {
    const { base, drafts } = services()
    let resolved: ReturnType<typeof enterprisePresetSessionPortsFrom>
    const launch = createEnterprisePresetLauncher(() => resolved)
    await expect(launch('first')).resolves.toBe(false)
    resolved = enterprisePresetSessionPortsFrom(base)
    await expect(launch('second')).resolves.toBe(true)
    expect(drafts).toEqual([{ sessionId: 'new-ws-empty', text: 'second' }])
  })
})
