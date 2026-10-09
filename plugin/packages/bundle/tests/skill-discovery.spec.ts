/**
 * [INPUT]: 依赖 `src/skill-discovery.ts` 的路由注册器、查看作用域闸门 `projectSkillViewScope`/`snapshotOptionsOf` 与两枚纯投影/形状常量、`src/index.ts` 源码文本（组合层接线反锁）、`@dshent/platform-client` 的 route port 类型、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定口径 54 的本机官方发现面路由——**必须带 `agentPresets.acquireScope()` 取到的那一枚 `scope` 去读**（不传 = 只读全局层 = 真机少报）、作用域取不到/租约形状不过/释放失败一律**明确失败码且绝不回落成全局层半份列表**、租约在成功与异常两条路径上都被释放、`cwd` 有就传没有就不给这一格（**不许编造路径**）、逐键白名单（`path`/`resourceBase` **不在**）、服务缺席/快照抛错/快照读不懂三类失败都回**明确失败码且绝不当空列表**、非 GET 405、只读不碰 SKILL.md 正文、以及「浏览器拿不到宿主绝对路径」这条泄漏面
 * [POS]: bundle 的技能发现取数回归门禁；有人把官方快照原样写出（`deepEqual(input)` 那一格会当场红）、把 `snapshot({})` 那条**不带 scope 的全局层读**改回来（本文件第一格就红）、把作用域取不到折成 200/空列表/3 条少报、把租约忘了释放、或凭空给一个 cwd，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import {
  ENTERPRISE_DISCOVERED_OPTIONAL_KEYS,
  ENTERPRISE_DISCOVERED_SKILL_KEYS,
  ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH,
  ENT_SKILL_DISCOVERY_UNAVAILABLE,
  projectDiscoveredSkills,
  projectSkillDiscoveryFailure,
  projectSkillViewScope,
  registerEnterpriseSkillDiscoveryRoute,
  snapshotOptionsOf,
  type EnterpriseSkillDiscoveryPort,
  type EnterpriseSkillSnapshotOptions,
  type EnterpriseSkillSnapshotPort,
} from '../src/skill-discovery.js'

/**
 * 官方 `skills.snapshot()` 的真实形状（宿主契约逐字）——**含**我们不许出厂的两格：
 * `path`（宿主绝对路径）与 `resourceBase`（`{kind:'directory',path}` 更是一枚绝对路径）。
 * 这份夹具故意带上它们：本刀要证的不是"我们没写这两格"，而是"它们进不了响应体"。
 */
const HOST_PATH = '/Users/somebody/.dsh/skills'
const SNAPSHOT = {
  complete: true,
  skills: [
    {
      path: `${HOST_PATH}/agent-manager`,
      name: 'agent-manager',
      description: '把子代理管起来',
      whenToUse: '需要多代理协作时',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'user-dsh',
      provider: 'skill-filesystem',
      resourceBase: { kind: 'directory', path: `${HOST_PATH}/agent-manager` },
    },
    {
      path: `${HOST_PATH}/skill-creator`,
      name: 'skill-creator',
      description: '写技能',
      invocation: { modelInvocable: false, userInvocable: true },
      source: 'bundled',
      provider: 'skill-filesystem',
      resourceBase: { kind: 'directory', path: `${HOST_PATH}/skill-creator` },
    },
  ],
}

const ENVELOPE_KEYS = ['skills', 'complete']

/**
 * 官方租约的释放协议 = TC39 `Symbol.asyncDispose`。
 * 与 `src/skill-discovery.ts` 同一手法：本仓 `lib` 停在 ES2023，编译器不认识这一枚，故显式取运行时符号。
 */
const ASYNC_DISPOSE: symbol = (Symbol as unknown as { readonly asyncDispose: symbol }).asyncDispose

/** 官方 `acquireScope()` 给的那一枚不透明作用域身份（官方实现里就是 `{agentPreset: <id>}` 这种对象）。 */
const SCOPE_KEY = { agentPreset: 'standard' }
/** 一个**假想的**项目根：只用来证"有就原样传"，本仓真机上并不存在这个来源（见 index.ts 接线注释）。 */
const PROJECT_CWD = '/Users/somebody/projects/demo'

describe('skill discovery projection', () => {
  it('只留白名单字段：逐键集合断言，且 path / resourceBase 不在里面', () => {
    const projected = projectDiscoveredSkills(SNAPSHOT)
    expect(Object.keys(projected)).toEqual(ENVELOPE_KEYS)
    expect(projected.complete).toBe(true)
    expect(projected.skills).toHaveLength(2)
    for (const each of projected.skills) {
      // ★逐键**集合**断言（不是"包含"）：多一格少一格都红。可选那一格缺席是**合法**的
      //   （"官方没说 whenToUse"与"官方说了空串"是两件事），故判据是**两枚允许的集合二选一**。
      const keys = new Set(Object.keys(each))
      expect(
        [
          ENTERPRISE_DISCOVERED_SKILL_KEYS.length,
          ENTERPRISE_DISCOVERED_SKILL_KEYS.length + ENTERPRISE_DISCOVERED_OPTIONAL_KEYS.length,
        ],
        '键数只能是白名单或白名单+可选',
      ).toContain(keys.size)
      for (const key of ENTERPRISE_DISCOVERED_SKILL_KEYS) expect(keys.has(key), key).toBe(true)
      for (const key of keys) {
        expect([...ENTERPRISE_DISCOVERED_SKILL_KEYS, ...ENTERPRISE_DISCOVERED_OPTIONAL_KEYS], key).toContain(key)
      }
      // ★泄漏面的两枚反向锁（`resourceBase.path` 与 `path` 都不许出现）。
      expect('path' in each).toBe(false)
      expect('resourceBase' in each).toBe(false)
    }
    // ① `whenToUse` 真的非空 ⇒ 出厂；② 缺席 ⇒ **不给这个键**（不编空串）。
    expect(projected.skills[0]).toEqual({
      name: 'agent-manager',
      description: '把子代理管起来',
      whenToUse: '需要多代理协作时',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'user-dsh',
      provider: 'skill-filesystem',
    })
    expect('whenToUse' in projected.skills[1]!).toBe(false)
    expect(projected.skills[1]!.invocation).toEqual({ modelInvocable: false, userInvocable: true })
    // ★来源标注的**唯一**依据就是 `source` 这一枚（不是路径）：它必须逐字出厂。
    expect(projected.skills.map(each => each.source)).toEqual(['user-dsh', 'bundled'])
  })

  it('整条响应体里一个宿主绝对路径字节都没有（含嵌套）', () => {
    const serialized = JSON.stringify(projectDiscoveredSkills(SNAPSHOT))
    expect(serialized).not.toContain(HOST_PATH)
    expect(serialized).not.toContain('/Users/')
    expect(serialized).not.toContain('directory')
  })

  it('空列表是合法结果（磁盘真的一枚都没有），与"读不到"泾渭分明', () => {
    expect(projectDiscoveredSkills({ skills: [], complete: true })).toEqual({ skills: [], complete: true })
  })

  it('快照读不懂 ⇒ 抛（绝不静默折成空列表）', () => {
    for (const bad of [
      null,
      [],
      'skills',
      {},
      { skills: [] },
      { skills: 'none', complete: true },
      { skills: [], complete: 'yes' },
      { skills: [null], complete: true },
      { skills: [{ description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: '', description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: { modelInvocable: true }, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: null, source: 'a', provider: 'b' }], complete: true },
      { skills: [{ name: 'a', description: 'x', invocation: { modelInvocable: true, userInvocable: true }, source: 7, provider: 'b' }], complete: true },
    ]) {
      // 判据落在**抛出的码**上（`toThrow(串)` 匹的是 message，这里要的是稳定码本身）。
      let caught: unknown
      try {
        projectDiscoveredSkills(bad)
      } catch (error) {
        caught = error
      }
      expect(caught, JSON.stringify(bad)).toBeInstanceOf(Error)
      expect((caught as { readonly code?: string }).code, JSON.stringify(bad)).toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
    }
  })

  it('失败投影：三枚都收在同一枚码上、状态码走唯一那张表（503）', () => {
    expect(projectSkillDiscoveryFailure(new Error('boom')))
      .toEqual({ status: 503, code: ENT_SKILL_DISCOVERY_UNAVAILABLE, step: 'snapshot-failed' })
    // 官方自己带受控码时**原样**透出（那是它的事实），状态码仍走同一张表。
    expect(projectSkillDiscoveryFailure(Object.assign(new Error('x'), { code: 'ENT_AUTH_REQUIRED' })))
      .toEqual({ status: 401, code: 'ENT_AUTH_REQUIRED', step: 'snapshot-failed' })
    // 非法形状的码一律回落本面稳定码，绝不复述任意字符串。
    expect(projectSkillDiscoveryFailure(Object.assign(new Error('x'), { code: 'not a code' })).code)
      .toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
  })
})

/**
 * ★本刀的核心那一格：**查看作用域**。
 *
 * 官方 `skills` 是层叠注册表（契约原文见 `src/skill-discovery.ts` 文件头 ④）：不传 `scope` 只读得到全局层，
 * 挂在 preset 层里的那些**整层漏掉**（真机读数：3 条 vs 磁盘 7 枚）。下面这组用例把
 * "取到 ⇒ 传进去"、"取不到 ⇒ 明确失败（绝不回落成全局层读）"、"拿到就必须释放"、"cwd 不许编造"四条钉死。
 */
describe('查看作用域闸门 projectSkillViewScope / snapshotOptionsOf', () => {
  let dispose: Mock<() => Promise<void>>

  /**
   * 官方 `acquireScope()` 的返回形状（逐字照官方实现）：一个普通对象字面量，带 `key` 与 `[Symbol.asyncDispose]`。
   * `overrides` 用来逐格造坏形状（`{key: undefined}` / `{[ASYNC_DISPOSE]: undefined}` / `{cwd: ''}` …）。
   */
  const officialLease = (overrides: Record<PropertyKey, unknown> = {}): Record<PropertyKey, unknown> => ({
    key: SCOPE_KEY,
    [ASYNC_DISPOSE]: dispose,
    ...overrides,
  })

  beforeEach(() => {
    dispose = vi.fn<() => Promise<void>>(async () => {})
  })

  it('接受官方租约：`key` 逐字同一引用、`dispose` 直译那枚异步释放、没有 cwd 就不给这一格', async () => {
    const scope = projectSkillViewScope(officialLease())
    expect(scope.key).toBe(SCOPE_KEY)
    expect('cwd' in scope).toBe(false)
    // `dispose` 真的调到了官方那枚符号上的函数（不是自己造的替代品）。
    await scope.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(snapshotOptionsOf(scope)).toEqual({ scope: SCOPE_KEY })
    expect(Object.keys(snapshotOptionsOf(scope))).toEqual(['scope'])
  })

  it('租约带 cwd 就原样带进 snapshot 入参（**不改写、不规范化**）', () => {
    const scope = projectSkillViewScope(officialLease({ cwd: PROJECT_CWD }))
    expect(scope.cwd).toBe(PROJECT_CWD)
    expect(snapshotOptionsOf(scope)).toEqual({ scope: SCOPE_KEY, cwd: PROJECT_CWD })
  })

  it('★六种坏租约一律当场拒（`step=scope-unavailable`）：它们正是"静默少报"或"漏挂载"的入口', () => {
    const cases: readonly (readonly [string, Record<PropertyKey, unknown>])[] = [
      ['没有 key：官方读法会退化成"只看全局层"（本刀那条少报）', officialLease({ key: undefined })],
      ['key 是 null：官方父链表是 WeakMap，null 得到空链 ⇒ 同样是静默全局层', officialLease({ key: null })],
      ['key 是原始值：同上，WeakMap 非对象键取不到父链', officialLease({ key: 'global' })],
      ['没有 [Symbol.asyncDispose]：租约释放不掉 ⇒ 每个请求漏一棵 preset 挂载', officialLease({ [ASYNC_DISPOSE]: undefined })],
      ['cwd 是空串：`resolve("")` 会变成宿主进程自己的 cwd ⇒ 凭空造了一条路径', officialLease({ cwd: '' })],
      ['cwd 不是字符串：宁可失败，也不猜一个路径', officialLease({ cwd: 7 })],
    ]
    for (const [label, lease] of cases) {
      let caught: unknown
      try {
        projectSkillViewScope(lease)
      } catch (error) {
        caught = error
      }
      expect(caught, label).toBeInstanceOf(Error)
      expect((caught as { readonly code?: string }).code, label).toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
      expect(projectSkillDiscoveryFailure(caught), label).toMatchObject({ status: 503, step: 'scope-unavailable' })
    }
    // 非对象形状（含 null / 数组）也在同一道闸门上（判据落在**抛出的码**上，不是 message）。
    for (const bad of [undefined, null, 'scope', 7, [], true]) {
      let caught: unknown
      try {
        projectSkillViewScope(bad)
      } catch (error) {
        caught = error
      }
      expect(caught, String(bad)).toBeInstanceOf(Error)
      expect((caught as { readonly code?: string }).code, String(bad)).toBe(ENT_SKILL_DISCOVERY_UNAVAILABLE)
      expect(projectSkillDiscoveryFailure(caught), String(bad)).toMatchObject({ status: 503, step: 'scope-unavailable' })
    }
  })
})

describe('GET /enterprise/api/v1/local/skills/discovered', () => {
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let snapshot: Mock<(options: EnterpriseSkillSnapshotOptions) => Promise<unknown>>
  let service: EnterpriseSkillSnapshotPort | undefined
  let acquireScope: Mock<() => Promise<unknown>>
  /** 下一次 `acquireScope()` 回什么（`undefined` = 此刻没有官方 `agentPresets` 服务）。 */
  let leaseResult: unknown
  let dispose: Mock<() => Promise<void>>
  let onError: Mock<(message: string, error: unknown) => void>

  const ASYNC_DISPOSE_LOCAL: symbol = ASYNC_DISPOSE

  /** 官方形状的租约（与上面那份"闸门"用例同一形状，保证两侧说的是同一件事）。 */
  const officialLease = (overrides: Record<PropertyKey, unknown> = {}): Record<PropertyKey, unknown> => ({
    key: SCOPE_KEY,
    [ASYNC_DISPOSE_LOCAL]: dispose,
    ...overrides,
  })

  const wire = (port: EnterpriseSkillDiscoveryPort | undefined): void => {
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        route = registered
        return () => { route = undefined }
      },
    }
    registerEnterpriseSkillDiscoveryRoute(webServer, port, onError)
  }

  /** 与组合层逐字同款：`discover()` 现场解引用、`acquireScope()` 现场取租约。 */
  const port = (): EnterpriseSkillDiscoveryPort => ({
    discover: () => service,
    acquireScope: () => acquireScope(),
  })

  const get = async (init?: RequestInit): Promise<Response> =>
    await fetch(`${baseUrl}${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`, init)

  beforeEach(async () => {
    route = undefined
    snapshot = vi.fn<(options: EnterpriseSkillSnapshotOptions) => Promise<unknown>>(async () => SNAPSHOT)
    service = { snapshot }
    dispose = vi.fn<() => Promise<void>>(async () => {})
    leaseResult = officialLease()
    acquireScope = vi.fn<() => Promise<unknown>>(async () => leaseResult)
    onError = vi.fn<(message: string, error: unknown) => void>()
    wire(port())
    server = createServer((incoming, response) => {
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(incoming, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('★① GET 200：`snapshot` 收到的是 `agentPresets.acquireScope()` 那一枚 `scope`（不是 `{}`）', async () => {
    expect(ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/discovered')
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: unknown }
    expect(Object.keys(body)).toEqual(['data'])
    expect(Object.keys(body.data as object)).toEqual(ENVELOPE_KEYS)
    expect(body.data).toEqual(projectDiscoveredSkills(SNAPSHOT))
    // ★本刀第一格：快照入参的**键集恰好**是 `['scope']`（多一格少一格都红、`{}` 也红），
    //   且这一枚身份就是 `acquireScope()` 给的那**同一个引用**（不是复制、不是自己造的）。
    const options = snapshot.mock.calls[0]![0]
    expect(Object.keys(options)).toEqual(['scope'])
    expect(options.scope).toBe(SCOPE_KEY)
    // 这一枚身份的唯一来源就是 agentPresets.acquireScope（不传 id = 默认/当前 preset）。
    expect(acquireScope).toHaveBeenCalledTimes(1)
    expect(acquireScope).toHaveBeenCalledWith()
    // ★结构级泄漏锁：整份响应正文里不许出现宿主绝对路径，也不许与官方快照**逐字相等**
    //   （后者是最强的反向锁：`deepEqual(输入)` 一旦成立就说明我们把它原样写出去了）。
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(HOST_PATH)
    expect(serialized).not.toContain('resourceBase')
    expect(serialized).not.toEqual(JSON.stringify({ data: SNAPSHOT }))
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('★② 作用域取不到 / 租约读不懂 ⇒ 明确失败码 503，**绝不回落成"只看全局层"的少报**（不是空列表）', async () => {
    const cases: readonly (readonly [string, unknown])[] = [
      ['老宿主没有官方 agentPresets 服务（acquireScope 回 undefined）', undefined],
      ['租约不是对象', 'scope'],
      ['租约是 null', null],
      ['租约没有 key（官方读法会退化成全局层）', officialLease({ key: undefined })],
      ['key 是 null', officialLease({ key: null })],
      ['key 是原始值', officialLease({ key: 'global' })],
      ['租约不可异步释放', officialLease({ [ASYNC_DISPOSE_LOCAL]: undefined })],
      ['cwd 非法（空串）', officialLease({ cwd: '' })],
    ]
    for (const [label, arranged] of cases) {
      snapshot.mockClear()
      onError.mockClear()
      acquireScope.mockClear()
      acquireScope.mockResolvedValueOnce(arranged)
      const response = await get()
      expect(response.status, label).toBe(503)
      const body = await response.json() as { readonly error?: unknown; readonly data?: unknown }
      expect(body, label).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
      expect(body.data, label).toBeUndefined()
      // ★反向锁：这一态**一次快照都没打** ⇒ 不可能出现"3 条全局层"那种半份列表，也不可能出现空列表。
      expect(snapshot, label).not.toHaveBeenCalled()
      expect(onError.mock.calls[0]![0], label).toContain('step=scope-unavailable')
      expect(onError.mock.calls[0]![0], label).toContain('status=503')
    }
    // ★"有服务但这次取不到"（preset 未知 / composition 不可用）走的是**同一枚码**，不是 200、也不是官方内部码。
    snapshot.mockClear()
    onError.mockClear()
    acquireScope.mockRejectedValueOnce(new Error('agent preset "standard" failed to mount'))
    const failed = await get()
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    expect(snapshot).not.toHaveBeenCalled()
    // 官方自己的内部码（这里刻意用一枚合法形状的）**不**透出：本面只说自己那枚码。
    snapshot.mockClear()
    onError.mockClear()
    acquireScope.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'ENT_AUTH_REQUIRED' }))
    const shaped = await get()
    expect(shaped.status).toBe(503)
    expect(await shaped.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    expect(onError.mock.calls[0]![0]).toContain('step=scope-unavailable')
  })

  it('★③ 租约必定被释放：成功路径释放一次、`snapshot()` 抛错路径也释放一次，且都发生在读之后', async () => {
    // —— 成功路径：读的时候租约必须还活着，读完之后才释放。
    const order: string[] = []
    snapshot.mockImplementationOnce(async () => { order.push('snapshot'); return SNAPSHOT })
    dispose.mockImplementationOnce(async () => { order.push('dispose') })
    expect((await get()).status).toBe(200)
    expect(order).toEqual(['snapshot', 'dispose'])
    expect(dispose).toHaveBeenCalledTimes(1)

    // —— 异常路径：`snapshot()` 抛也必须释放（否则每个失败请求都漏一棵 preset 挂载）。
    const failureOrder: string[] = []
    snapshot.mockClear()
    dispose.mockClear()
    onError.mockClear()
    snapshot.mockImplementationOnce(async () => { failureOrder.push('snapshot'); throw new Error('scan exploded') })
    dispose.mockImplementationOnce(async () => { failureOrder.push('dispose') })
    const failed = await get()
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    expect(failureOrder).toEqual(['snapshot', 'dispose'])
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0]).toContain('step=snapshot-failed')
  })

  it('★③b 释放失败绝不被吞：没有主错误时它就是这次的失败；有主错误时以主错误为准（不遮蔽真因）', async () => {
    // (a) 只有释放失败 ⇒ 503 + `step=scope-release-failed`，**不是** 200（漏挂载不许装作没事）。
    dispose.mockRejectedValueOnce(new Error('release exploded'))
    const releaseOnly = await get()
    expect(releaseOnly.status).toBe(503)
    expect(await releaseOnly.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    expect(onError.mock.calls[0]![0]).toContain('step=scope-release-failed')
    expect(onError.mock.calls[0]![0]).toContain('release exploded')

    // (b) 主错误 + 释放失败 ⇒ 真因仍是主错误（快照失败），释放失败另留一条日志。
    //     判据落在"两条日志各自都在"上（先后顺序是时序细节，不是契约）。
    snapshot.mockClear()
    dispose.mockClear()
    onError.mockClear()
    snapshot.mockRejectedValueOnce(new Error('scan exploded'))
    dispose.mockRejectedValueOnce(new Error('release exploded'))
    const both = await get()
    expect(both.status).toBe(503)
    expect(await both.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    const lines = onError.mock.calls.map(([message]) => message)
    expect(lines.some(message => message.includes('step=snapshot-failed') && message.includes('scan exploded'))).toBe(true)
    expect(lines.some(message => message.includes('step=scope-release-failed') && message.includes('release exploded'))).toBe(true)
  })

  it('★④ `cwd` 有就原样传、没有就**不给这个键**（**绝不编造路径**）', async () => {
    // 有：原样那一个字节。
    leaseResult = officialLease({ cwd: PROJECT_CWD })
    expect((await get()).status).toBe(200)
    expect(snapshot.mock.calls[0]![0]).toEqual({ scope: SCOPE_KEY, cwd: PROJECT_CWD })

    // 没有：**没有这个键** —— 不是 `undefined`、不是空串、更不是宿主进程自己的 cwd。
    snapshot.mockClear()
    leaseResult = officialLease()
    const response = await get()
    expect(response.status).toBe(200)
    const options = snapshot.mock.calls[0]![0]
    expect(Object.keys(options)).toEqual(['scope'])
    expect('cwd' in options).toBe(false)
    expect(JSON.stringify(options)).not.toContain(process.cwd())
    expect(JSON.stringify(options)).not.toContain('/Users/')
    // 响应体里也不许多出任何宿主绝对路径。
    expect(JSON.stringify(await response.json())).not.toContain('/Users/')

    // 非法 cwd（空串会被 `resolve('')` 变成宿主进程 cwd = 凭空造路径；非串同罪）⇒ 明确失败，连快照都不打。
    for (const bad of ['', 7, null, {}]) {
      snapshot.mockClear()
      onError.mockClear()
      leaseResult = officialLease({ cwd: bad })
      const failed = await get()
      expect(failed.status, String(bad)).toBe(503)
      expect(await failed.json(), String(bad)).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
      expect(snapshot, String(bad)).not.toHaveBeenCalled()
    }
  })

  it('★组合层接线反锁（源码级）：`acquireScope` 真的取官方 `agentPresets`，且**不由我们自己造 cwd**', async () => {
    const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).toContain("ctx.get('agentPresets')")
    // 不传 id = 默认/当前 preset；**原样转交**官方租约（形状与释放都在 skill-discovery.ts 那一处判）。
    expect(source).toContain('presets.acquireScope()')
    expect(source).toContain('acquireScope: async () =>')
    // ★"拿不到就不传"：组合层**没有**任何凭空造路径的入口（`process.cwd()` 不是 cwd 的来源）。
    expect(source).not.toContain('process.cwd()')
    expect(source).not.toMatch(/cwd:\s*['"]/)
  })

  it('`complete=false` 原样出厂（那是官方自己的交代，不许被我们折成 true 或 0）', async () => {
    snapshot.mockResolvedValueOnce({ skills: SNAPSHOT.skills.slice(0, 1), complete: false })
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: { readonly complete: boolean; readonly skills: readonly unknown[] } }
    expect(body.data.complete).toBe(false)
    expect(body.data.skills).toHaveLength(1)
  })

  it('★服务缺席（老宿主没有 skills 服务）⇒ 明确失败码 503，**绝不空列表**', async () => {
    service = undefined
    const response = await get()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    // 反向锁：这一态**没有**打过快照、**没有**取过作用域（连租约都不该建，免得白漏一次挂载）、也**没有**任何 200。
    expect(snapshot).not.toHaveBeenCalled()
    expect(acquireScope).not.toHaveBeenCalled()
    expect(dispose).not.toHaveBeenCalled()
    const [message] = onError.mock.calls[0]!
    expect(message).toContain(`operation=GET ${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH}`)
    expect(message).toContain('step=service-absent')
    expect(message).toContain('status=503')
  })

  it('组合层整个没接线（端口缺席）⇒ 同一枚码，不是 404、不是 200+空', async () => {
    wire(undefined)
    const response = await get()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('★snapshot 抛错 ⇒ 明确失败码 503，**绝不空列表**', async () => {
    snapshot.mockRejectedValueOnce(new Error('scan exploded'))
    const response = await get()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
    const [message, error] = onError.mock.calls[0]!
    expect(message).toContain('step=snapshot-failed')
    expect(message).toContain('scan exploded')
    expect(error).toBeInstanceOf(Error)
  })

  it('★快照读不懂 ⇒ 明确失败码 503（不是 200+空列表）', async () => {
    snapshot.mockResolvedValueOnce({ skills: 'nope', complete: true })
    const response = await get()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_DISCOVERY_UNAVAILABLE } })
  })

  it('非 GET 一律 405 + Allow: GET，且不触发任何快照/作用域/释放', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await get({ method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('GET')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(snapshot).not.toHaveBeenCalled()
    expect(acquireScope).not.toHaveBeenCalled()
    expect(dispose).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
