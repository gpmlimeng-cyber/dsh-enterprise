/**
 * [INPUT]: 依赖 list-state 的四态取数源与三份纯投影（`createEnterpriseListSource`/`enterpriseDegradedRead`/`enterpriseDetailState`）、
 *          marketplace-entry 的 `createEnterpriseSkillCatalogSource`、skill-market 的 `createEnterpriseSkillListSource`、
 *          preset-market 的 `createEnterprisePresetListSource`、plugin-market 的目录四态投影，
 *          以及 local-api 的 `createEnterpriseLocalApi(fetcher)`（**注入假 fetch 数请求次数**）
 * [OUTPUT]: 锁定本刀的行为契约：列表四态互斥（加载 / 空 / 失败 / 就绪）、失败**不回落成空列表**、
 *          **点重试真的重发一次请求**（假 fetch double 逐次数请求）、重试在途有进行中态、重试再失败仍可再试、
 *          迟到结果不回填、次级取数降级必须交出失败码（不是静默默认值）、详情取数失败与「列表级信息」可区分、
 *          插件目录四态（含搜索/已装筛选各自的「为什么空」）
 * [POS]: 本刀「静默吞失败 → 显式失败态 + 可重试」的**行为门禁**。本仓 vitest 没有 DOM，无法渲染 hook，
 *        故行为取证落在组件真正订阅的那个共享取数源上（组件只是 `useSyncExternalStore` 的订户 + 一枚重试按钮）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'

// 三个列表视图都经官方 primitives 渲染（本仓未装 clsx），故照既有用例的同一份 mock 把它们换掉：
// 本用例只关心取数状态机，不渲染任何原子组件。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
}))

import {
  ENTERPRISE_DETAIL_FAILED,
  ENTERPRISE_LIST_RETRY,
  createEnterpriseListSource,
  enterpriseDegradedRead,
  enterpriseDetailState,
  type EnterpriseListState,
} from '../src/list-state.js'
import {
  ENTERPRISE_MARKET_PLUGINS_EMPTY,
  ENTERPRISE_MARKET_SKILLS_EMPTY,
  ENTERPRISE_MARKET_SKILLS_FAILED,
  ENTERPRISE_MARKET_SKILLS_LOADING,
  createEnterpriseSkillCatalogSource,
  enterpriseMarketPanelState,
} from '../src/marketplace-entry.js'
import { createEnterpriseSkillListSource } from '../src/skill-market.js'
import { createEnterprisePresetListSource } from '../src/preset-market.js'
import {
  ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH,
  ENTERPRISE_PLUGIN_VERSION_UNREADABLE,
  enterprisePluginCatalogEmptyText,
  enterprisePluginCatalogState,
  enterprisePluginCatalogVersionText,
} from '../src/plugin-market.js'
import { createEnterpriseLocalApi, ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH } from '../src/local-api.js'
import type { EnterpriseInstalledSkill, EnterpriseRuntimePreset, EnterpriseRuntimeSkill } from '../src/local-api.js'

/** 一次取数的完成（假 fetch 走的是 Promise 链，多让几个宏任务过去即可稳定观察）。 */
async function settle(times = 6): Promise<void> {
  for (let index = 0; index < times; index += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

const skill = (id: string, versionId = ''): EnterpriseRuntimeSkill => ({
  id,
  skillId: 'code-review',
  displayName: '公司代码评审技能',
  description: '按企业检查单评审改动。',
  sourceDshVersion: '0.1.7-rc.2',
  sizeBytes: 20_480,
  skillCount: 1,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId,
  skills: [],
})

/**
 * 列表投影的**线上形状**：只含摘要那 8 个键。
 * 解码层的键集是封闭的——列表里多塞 `versionId`/`skills`（详情专有）会判畸形，故这里必须剥掉它们。
 */
function skillSummaryWire(id: string): Record<string, unknown> {
  const { versionId: _versionId, skills: _skills, ...summary } = skill(id)
  return summary
}

/** 中心**详情**的线上形状（比列表多 `versionId` + `sha256` + `skills`——解码层要这三样）。 */
function skillDetailWire(id: string, versionId: string): Record<string, unknown> {
  return {
    ...skill(id),
    versionId,
    sha256: 'a'.repeat(64),
    skills: [{ name: 'code-review', description: '按检查单评审改动', modelInvocable: true, userInvocable: true }],
  }
}

const installed = (packageId: string): EnterpriseInstalledSkill => ({
  packageId,
  skillId: 'code-review',
  displayName: '公司代码评审技能',
  versionId: '9001',
  sha256: 'a'.repeat(64),
  names: ['code-review'],
  installedAt: '2026-09-30T08:00:00Z',
})

const preset = (id: string): EnterpriseRuntimePreset => ({
  id,
  presetId: 'review-agent',
  displayName: '代码评审智能体',
  description: '带检查单的评审配方。',
  sourceDshVersion: '0.1.7-rc.2',
  sizeBytes: 4096,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId: '7001',
})

/** 单键信封成功响应（与 local-api 的 `{data}` 契约同形）。 */
function ok(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' }, status: 200 })
}

/** 失败响应：状态码取本地路由那张表里的 503，正文带稳定码（与 Host 的错误投影同形）。 */
function failed(code: string): Response {
  return new Response(JSON.stringify({ error: { code } }), { headers: { 'content-type': 'application/json' }, status: 503 })
}

/** 假 fetch：逐个请求交给 handler，并把**每一次**请求路径记下来（重试必须让它真的 +1）。 */
function fetchDouble(handler: (path: string, call: number) => Response): { readonly fetcher: typeof fetch; readonly calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    return handler(path, calls.length)
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

describe('enterprise list source (loading / empty / ready / failed)', () => {
  it('starts in loading, then settles into exactly one of empty / ready (never both)', async () => {
    const deferred = (() => {
      let resolve!: (value: readonly string[]) => void
      const promise = new Promise<readonly string[]>((done) => { resolve = done })
      return { promise, resolve }
    })()
    const source = createEnterpriseListSource<readonly string[]>({
      load: () => deferred.promise,
      isEmpty: value => value.length === 0,
    })
    // 首帧就是「加载中」：界面据此出轻提示，不必靠「行数为 0」反推。
    expect(source.getSnapshot()).toEqual({ kind: 'loading' })
    source.load()
    expect(source.requests()).toBe(1)
    expect(source.getSnapshot().kind).toBe('loading')
    deferred.resolve([])
    await settle()
    // 空 ≠ 失败：取数成功但列表为空是 **empty**（有自己的「为什么空」文案）。
    expect(source.getSnapshot()).toEqual({ kind: 'empty', value: [] })
    deferred.resolve(['a'])
    await settle()
    // 迟到结果不回填：状态仍是 empty。
    expect(source.getSnapshot().kind).toBe('empty')
  })

  it('never turns a failed read into an empty list (the bug this cut removes)', async () => {
    const source = createEnterpriseListSource<readonly string[]>({
      load: async () => { throw new Error('boom') },
      isEmpty: value => value.length === 0,
    })
    source.load()
    await settle()
    const snapshot = source.getSnapshot()
    expect(snapshot.kind).toBe('failed')
    // 关键：**不是** empty、也不是「有值但为空」——失败必须自己是一态。
    expect(snapshot).not.toEqual({ kind: 'empty', value: [] })
    expect((snapshot as Extract<EnterpriseListState<readonly string[]>, { kind: 'failed' }>).code).toBe('ENT_LOCAL_UNAVAILABLE')
  })

  it('retry really re-issues the request and shows an in-progress state while it is in flight', async () => {
    // 真 fetch double：数请求次数（「点重试」在真运行时就是调同一个 retry()）。
    const { fetcher, calls } = fetchDouble((_path, call) => (call === 1 ? failed('ENT_PLATFORM_UNAVAILABLE') : ok([preset('7001')])))
    const source = createEnterprisePresetListSource(createEnterpriseLocalApi(fetcher))
    source.load()
    await settle()
    expect(source.getSnapshot().kind).toBe('failed')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe('/enterprise/api/v1/local/presets')

    source.retry()
    // 重试**立刻**进入进行中态（同一时刻只有一个状态，不会同时显示失败与加载）。
    expect(source.getSnapshot().kind).toBe('loading')
    expect(source.requests()).toBe(2)
    await settle()
    expect(calls).toHaveLength(2)
    // 就绪那一态带着**新一次请求**的结果（不是上一轮的残留）。
    expect(source.getSnapshot()).toEqual({ kind: 'ready', value: [preset('7001')] })
    // 就绪后不再自动重发（load 是幂等的，只有显式 retry 才发新请求）。
    source.load()
    await settle()
    expect(calls).toHaveLength(2)
  })

  it('keeps retrying after a retry fails again (no one-shot retry)', async () => {
    const { fetcher, calls } = fetchDouble(() => failed('ENT_LOCAL_UNAVAILABLE'))
    const source = createEnterpriseSkillListSource(createEnterpriseLocalApi(fetcher))
    source.load()
    await settle()
    expect(source.getSnapshot().kind).toBe('failed')
    source.retry()
    await settle()
    expect(source.getSnapshot().kind).toBe('failed')
    source.retry()
    await settle()
    expect(source.getSnapshot().kind).toBe('failed')
    // 三条请求 = 首载 + 两次重试；失败态仍可再点（不给必然失败的重试画饼，但也不锁死重试）。
    expect(calls.filter(path => path.endsWith('/skills')).length).toBe(3)
    expect((source.getSnapshot() as { kind: string }).kind).toBe('failed')
  })

  it('drops the late result of an aborted round (reset / re-retry never mixes two rounds)', async () => {
    const rounds: Array<{ resolve: (value: readonly string[]) => void }> = []
    const source = createEnterpriseListSource<readonly string[]>({
      load: () => new Promise<readonly string[]>((resolve) => { rounds.push({ resolve }) }),
      isEmpty: value => value.length === 0,
    })
    source.load()
    source.retry()
    expect(source.requests()).toBe(2)
    // 第一轮迟到（aborted）：不回填。
    rounds[0]!.resolve(['stale'])
    await settle()
    expect(source.getSnapshot().kind).toBe('loading')
    rounds[1]!.resolve(['fresh'])
    await settle()
    expect(source.getSnapshot()).toEqual({ kind: 'ready', value: ['fresh'] })
    // reset 回到初始加载态，之后的迟到结果同样被丢弃。
    source.reset()
    expect(source.getSnapshot().kind).toBe('loading')
    rounds[1]!.resolve(['later'])
    await settle()
    expect(source.getSnapshot().kind).toBe('loading')
  })
})

describe('enterprise degraded read (secondary facts)', () => {
  it('hands back the stable code instead of swallowing the failure', async () => {
    await expect(enterpriseDegradedRead(Promise.resolve(['a']), [] as readonly string[]))
      .resolves.toEqual({ value: ['a'] })
    const degraded = await enterpriseDegradedRead(Promise.reject(new Error('offline')), [] as readonly string[])
    expect(degraded.value).toEqual([])
    // 降级必须**如实交出失败码**（界面据此说「这份事实没读出来」+ 可重试）。
    expect(degraded.code).toBe('ENT_LOCAL_UNAVAILABLE')
  })
})

describe('enterprise skill catalog (marketplace page)', () => {
  it('fails explicitly when the catalog read fails, keeping installed and detail reads out of the picture', async () => {
    const { fetcher, calls } = fetchDouble((path) => (path === ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH
      ? ok({ skills: [] })
      : failed('ENT_AUTH_SESSION_EXPIRED')))
    const source = createEnterpriseSkillCatalogSource(createEnterpriseLocalApi(fetcher))
    source.load()
    await settle()
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_AUTH_SESSION_EXPIRED' })
    expect(calls).toContain('/enterprise/api/v1/local/skills')
    // 目录失败即止：不再拿空目录冒充「企业技能 0」，也不继续白跑详情。
    expect(source.requests()).toBe(1)
  })

  it('keeps the catalog usable when only the installed list (or one detail) fails, and says so', async () => {
    const { fetcher } = fetchDouble((path, call) => {
      if (path === ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH) return ok({ skills: [installed('1902500000000000001')] })
      if (path === '/enterprise/api/v1/local/skills') return ok([skillSummaryWire('1902500000000000001')])
      // 已装行的详情（判「有更新」用）
      return call === 3 ? ok(skillDetailWire('1902500000000000001', '9001')) : failed('ENT_PLATFORM_UNAVAILABLE')
    })
    const source = createEnterpriseSkillCatalogSource(createEnterpriseLocalApi(fetcher))
    source.load()
    await settle()
    const snapshot = source.getSnapshot()
    expect(snapshot).toEqual({
      kind: 'ready',
      value: { rows: [expect.objectContaining({ id: '1902500000000000001', latestVersionId: '9001' })], installed: [installed('1902500000000000001')] },
    })
    expect(snapshot.kind === 'ready' ? snapshot.value.rows.map(row => row.id) : []).toEqual(['1902500000000000001'])
    expect(snapshot.kind === 'ready' ? snapshot.value.installedCode : 'x').toBeUndefined()
    expect(snapshot.kind === 'ready' ? snapshot.value.detailCode : 'x').toBeUndefined()

    // 已装清单失败：目录照列，但**如实交出降级码**（界面出「本机已装状态暂时没有读取到」+ 重试）。
    const degraded = fetchDouble((path) => (path === ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH
      ? failed('ENT_LOCAL_UNAVAILABLE')
      : ok([skillSummaryWire('1902500000000000002')])))
    const degradedSource = createEnterpriseSkillCatalogSource(createEnterpriseLocalApi(degraded.fetcher))
    degradedSource.load()
    await settle()
    const next = degradedSource.getSnapshot()
    expect(next.kind).toBe('ready')
    expect(next.kind === 'ready' ? next.value.rows.length : 0).toBe(1)
    expect(next.kind === 'ready' ? next.value.installedCode : undefined).toBe('ENT_LOCAL_UNAVAILABLE')
  })

  it('is empty (not failed) when the catalog really has no rows', async () => {
    const { fetcher } = fetchDouble((path) => (path === ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH ? ok({ skills: [] }) : ok([])))
    const source = createEnterpriseSkillCatalogSource(createEnterpriseLocalApi(fetcher))
    source.load()
    await settle()
    expect(source.getSnapshot()).toEqual({ kind: 'empty', value: { rows: [], installed: [] } })
  })
})

describe('detail reads are distinguishable from list-level information', () => {
  it('projects none / loading / list-level / detail with a fixed priority', () => {
    expect(enterpriseDetailState({ selected: false, loading: false, hasDetail: false })).toEqual({ kind: 'none' })
    expect(enterpriseDetailState({ selected: true, loading: true, hasDetail: false })).toEqual({ kind: 'loading' })
    expect(enterpriseDetailState({ selected: true, loading: true, hasDetail: false, errorCode: 'ENT_UPSTREAM_TIMEOUT' }))
      .toEqual({ kind: 'list-level', code: 'ENT_UPSTREAM_TIMEOUT' })
    expect(enterpriseDetailState({ selected: true, loading: false, hasDetail: true, errorCode: 'ENT_UPSTREAM_TIMEOUT' }))
      .toEqual({ kind: 'detail' })
    // 文案是共享的一句：详情失败时明确说「你看到的是列表里的信息」。
    expect(ENTERPRISE_DETAIL_FAILED.length).toBeGreaterThan(0)
  })
})

describe('directory tab panel states (skills / plugins)', () => {
  it('keeps the hidden state for a disabled component and the legacy row-count rule when no list state is injected', () => {
    const base = {
      loadingHint: ENTERPRISE_MARKET_SKILLS_LOADING,
      emptyHint: ENTERPRISE_MARKET_SKILLS_EMPTY,
      failedPrefix: ENTERPRISE_MARKET_SKILLS_FAILED,
      rowCount: 2,
    }
    expect(enterpriseMarketPanelState({ ...base, enabled: false })).toEqual({ kind: 'hidden' })
    // 缺席 list 时严格保持旧口径：有行就绪、没行隐藏（既有用例因此一字不变）。
    expect(enterpriseMarketPanelState({ ...base, enabled: true })).toEqual({ kind: 'ready' })
    expect(enterpriseMarketPanelState({ ...base, enabled: true, rowCount: 0 })).toEqual({ kind: 'hidden' })
  })

  it('maps the four list states onto one panel state each (mutually exclusive)', () => {
    const base = {
      enabled: true,
      loadingHint: ENTERPRISE_MARKET_SKILLS_LOADING,
      emptyHint: ENTERPRISE_MARKET_SKILLS_EMPTY,
      failedPrefix: ENTERPRISE_MARKET_SKILLS_FAILED,
      rowCount: 0,
    }
    expect(enterpriseMarketPanelState({ ...base, list: { kind: 'loading' } }))
      .toEqual({ kind: 'loading', hint: ENTERPRISE_MARKET_SKILLS_LOADING })
    expect(enterpriseMarketPanelState({ ...base, list: { kind: 'empty', value: [] } }))
      .toEqual({ kind: 'empty', hint: ENTERPRISE_MARKET_SKILLS_EMPTY })
    expect(enterpriseMarketPanelState({ ...base, list: { kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE' } }))
      .toEqual({ kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE', prefix: ENTERPRISE_MARKET_SKILLS_FAILED })
    expect(enterpriseMarketPanelState({ ...base, rowCount: 3, list: { kind: 'ready', value: [] } })).toEqual({ kind: 'ready' })
    // 空态与失败态是两句话：空的「为什么空」绝不含错误码。
    expect(ENTERPRISE_MARKET_SKILLS_EMPTY).not.toContain('ENT_')
    expect(ENTERPRISE_MARKET_PLUGINS_EMPTY).not.toContain('ENT_')
  })

  it('explains the plugin catalog with four states plus per-reason empty copy', () => {
    const base = { connected: true, loading: false, rowCount: 0, catalogCount: 0, searching: false, view: 'all' as const }
    expect(enterprisePluginCatalogState({ ...base, connected: false }).kind).toBe('signed-out')
    expect(enterprisePluginCatalogState({ ...base, loading: true }).kind).toBe('loading')
    expect(enterprisePluginCatalogState({ ...base, errorCode: 'ENT_PLATFORM_UNAVAILABLE' }))
      .toEqual({ kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE' })
    expect(enterprisePluginCatalogState(base)).toEqual({ kind: 'empty', reason: 'catalog' })
    expect(enterprisePluginCatalogState({ ...base, catalogCount: 3, searching: true }))
      .toEqual({ kind: 'empty', reason: 'search' })
    expect(enterprisePluginCatalogState({ ...base, catalogCount: 3, view: 'installed' })).toEqual({ kind: 'empty', reason: 'installed' })
    expect(enterprisePluginCatalogState({ ...base, rowCount: 2 })).toEqual({ kind: 'ready' })
    // 「空」的三句话各说各的「为什么空」。
    expect(enterprisePluginCatalogEmptyText('search')).toBe(ENTERPRISE_PLUGIN_LIST_EMPTY_SEARCH)
    expect(enterprisePluginCatalogEmptyText('installed')).not.toBe(enterprisePluginCatalogEmptyText('catalog'))
    // 目录没取到时详情那一格不谎称「已下架」。
    expect(enterprisePluginCatalogVersionText({ catalogState: { kind: 'failed', code: 'ENT_PLATFORM_UNAVAILABLE' } }))
      .toBe(ENTERPRISE_PLUGIN_VERSION_UNREADABLE)
    expect(enterprisePluginCatalogVersionText({ catalogState: { kind: 'ready' }, version: '1.2.0' })).toBe('1.2.0')
  })

  it('exposes the shared retry word so every list retries with the same label', () => {
    expect(ENTERPRISE_LIST_RETRY).toBe('重试')
  })
})
