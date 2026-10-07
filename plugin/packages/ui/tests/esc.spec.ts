/**
 * [INPUT]: 依赖 esc 各模块的真源（`esc-copy` 的文案、`esc-constants` 的常量、`esc-api` 的取数面、`esc-entry` 的两处座位、`esc-list` 的适配器表与分类投影）与一个假 `fetch`
 * [OUTPUT]: 锁定口径 31 的界面侧契约：① **文案逐字**（与 NUWAX `zh-CN.ts` 同值，不许"顺手润色"）；② 左栏三项与资源类型全集；③ 两处座位的身份（`sidebar.panellist` 的 id 与 `main` 的 key **同名**、order/label）与**常驻**注册（与资料库那两处由门驱动不同）；④ 取数面只打同源固定路径、正文关闭键集 `{path, params}`、六个方法各自的平台路径、错误码投影；⑤ **适配器口径**（各资源类型 × 数据源的真实参数差异，这是移植里最容易抄错的地方）与响应提取判据；⑥ **本轮两条用户裁决**：非选中页签的色阶（dimmed → tertiary：三行同步，带反向下锁）与移动端「整页单滚动面」那一档（滚动面由列表提到内容区；含"挪了滚动面之后触底加载与自动补拉必须跟着挪"的源码级锁）；⑦ **本刀四组**：触碰底入口必须问 hasMore（真机故障「下滑加载不起作用、一直闪屏」的两条纯判据双向断言 + 源码级反向锁）、顶部两行 18px 与分类行 gap 8px、字号一律走 calc(基准+两 delta) 且不许有裸 px 字号、精选上下间距相等（20 = 6+14）与精选最多画 6 枚；⑧ **口径 39 两条真机裁决**：网格列模板走**同一真源** `--esc-grid-cols`（算式三数从 CSS 提取后比对，532/560/800/1200 四档列数为 `[2,2,2,4]`，并把旧规则在同两姿态上的 `[1,2]` 钉成受检事实）+ 技能卡头行居中与动作位进流（含"不许再作为卡片直属子节点"的源码级反向锁）
 * [POS]: esc 页面的**无 React 契约回归**；视觉与真实交互由构建产物手工冒烟覆盖（本仓 vitest 没有 DOM）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createEnterpriseEscApi,
  enterpriseEscImageSrc,
  escErrorCodeOf,
  escPlatformErrorCode,
  ENTERPRISE_ESC_IMAGE_LOCAL_PATH,
  ENTERPRISE_ESC_MOCK_LOCAL_PATH,
  ENTERPRISE_ESC_READ_LOCAL_PATH,
  ESC_MISSING_ENDPOINT_CODES,
  type EnterpriseEscApi,
} from '../src/esc/esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import { EnterpriseEscCard, SKILL_MORE_ENTRIES } from '../src/esc/esc-card.js'
import { EnterpriseEscToolbar } from '../src/esc/esc-toolbar.js'
import { ENTERPRISE_ESC_FEATURED_MAX, enterpriseEscFeaturedBody } from '../src/esc/esc-featured.js'
import {
  enterpriseErrorAction,
  enterpriseErrorMessage,
  enterpriseErrorPresentation,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { ESC_DEFAULT_CATEGORY_MENUS, ESC_RESOURCE_MORE_HREF, ESC_RESOURCE_TYPES, ESC_SUCCESS_CODE } from '../src/esc/esc-constants.js'
import {
  bindEnterpriseEscSeats,
  ENTERPRISE_ESC_ENTRY_ID,
  ENTERPRISE_ESC_ENTRY_LABEL,
  ENTERPRISE_ESC_ENTRY_ORDER,
  enterpriseEscMainOptions,
  enterpriseEscPanelOptions,
} from '../src/esc/esc-entry.js'
import { decideAutoFill, shouldTriggerBottomLoad } from '../src/esc/esc-aggregation.js'
import { escCategoryChildrenOf, escResourceAdapters, missingEndpointCodeOf } from '../src/esc/esc-list.js'
import { EnterpriseEscResourceTabs } from '../src/esc/esc-resource-tabs.js'
import { EnterpriseEscStyle } from '../src/esc/esc-style.js'
import type { EscCategoryNode, EscRecommendRecord } from '../src/esc/esc-types.js'

// 官方原语包在本仓不可直接加载（它依赖的 `clsx` 没进本包依赖树），既有 ui 测试一律 mock 掉它；
// 本文件不渲染任何组件，只需让模块图加载得起来。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  Pill: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

describe('esc：文案与常量（与原页面逐字一致）', () => {
  it('文案表每一条都是 NUWAX zh-CN 表里的原文（页内 13 句 + 跨页 5 枚 + 行内字面量 2 枚）', () => {
    expect(ENTERPRISE_ESC_COPY).toMatchObject({
      pageTitle: '专家·技能·连接器',
      menuExpert: '专家&专家团',
      menuSkill: '技能',
      menuConnector: '连接器',
      mainTabSystem: '系统广场',
      mainTabTeam: '团队空间',
      mainTabConnected: '已连接的',
      mainTabEnabled: '我启用的',
      tabAll: '全部',
      searchPlaceholder: '搜索名称或描述...',
      more: '更多',
      summon: '召唤',
      useNow: '立即使用',
      paid: '付费',
      subscribed: '已订阅',
      collect: '收藏',
      cancelCollect: '取消收藏',
      emptyData: '暂无数据',
    })
  })

  it('资源类型全集与左栏兜底菜单的顺序、文案、原路径、原图标标识一字不差（专家的显示名按用户裁决改为「专家」）', () => {
    expect(ESC_RESOURCE_TYPES).toEqual(['expert', 'skill', 'connector'])
    expect(ESC_SUCCESS_CODE).toBe('0000')
    // 用户裁决「专家专家团，名字只显示专家即可」：显示层是 `menuExpertDisplay`（正字 `menuExpert` 仍是官方那串）
    expect(ENTERPRISE_ESC_COPY.menuExpert).toBe('专家&专家团')
    expect(ENTERPRISE_ESC_COPY.menuExpertDisplay).toBe('专家')
    expect(ESC_DEFAULT_CATEGORY_MENUS).toEqual([
      { code: 'expert', label: '专家', path: '/expert-skill-connector/expert', icon: 'icons-nav-user' },
      { code: 'skill', label: '技能', path: '/expert-skill-connector/skill', icon: 'icons-nav-skill' },
      { code: 'connector', label: '连接器', path: '/expert-skill-connector/connector', icon: 'icons-common-link' },
    ])
  })
})

describe('esc：两处座位（常驻，与资料库的视图驱动不同）', () => {
  it('侧栏 id 与 main 的 key 同名，order/label 是导出常量本身', () => {
    const panel = enterpriseEscPanelOptions()
    expect(panel).toEqual({
      name: 'sidebar.panellist',
      id: ENTERPRISE_ESC_ENTRY_ID,
      order: ENTERPRISE_ESC_ENTRY_ORDER,
      label: ENTERPRISE_ESC_ENTRY_LABEL,
    })
    expect(ENTERPRISE_ESC_ENTRY_ID).toBe('expert-skill-connector')
    expect(ENTERPRISE_ESC_ENTRY_LABEL).toBe('专家·技能·连接器')
    // 排在官方 plugins(0)/schedules(10) 与本仓资料库(20) 之后
    expect(ENTERPRISE_ESC_ENTRY_ORDER).toBe(30)
    const api = { name: 'api' } as unknown as EnterpriseEscApi
    const main = enterpriseEscMainOptions(api)
    expect(main['name']).toBe('main')
    expect(main['key']).toBe(panel['id'])
    expect((main['inject'] as () => { api: unknown })()).toEqual({ api })
  })

  it('接线即注册两个占用者（不设管理门）：两次 inject、两处 register', () => {
    const injected: string[] = []
    const registered: Record<string, unknown>[] = []
    const ports = {
      inject: (name: string, register: () => unknown) => { injected.push(name); return register() },
      register: (options: Record<string, unknown>) => { registered.push(options); return () => undefined },
    }
    const api = { name: 'api' } as unknown as EnterpriseEscApi
    const disposers = bindEnterpriseEscSeats(ports, api)
    expect(injected).toEqual(['sidebar.panellist', 'main'])
    expect(registered.map(item => item['name'])).toEqual(['sidebar.panellist', 'main'])
    expect(registered.map(item => item['key'] ?? item['id'])).toEqual([
      ENTERPRISE_ESC_ENTRY_ID,
      ENTERPRISE_ESC_ENTRY_ID,
    ])
    // 两处都真的拿到了注销器（否则插件卸载时座位摘不掉）
    expect(disposers).toHaveLength(2)
    for (const dispose of disposers) expect(typeof dispose).toBe('function')
  })
})

/** 假 fetch：记下每次请求，按测试给的响应体返回。 */
function fakeFetcher(payload: unknown, init?: { readonly ok?: boolean; readonly status?: number }) {
  const calls: { readonly url: string; readonly init: RequestInit | undefined }[] = []
  const fetcher = vi.fn(async (url: string, initArg?: RequestInit) => {
    calls.push({ url, init: initArg })
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: async () => payload,
    } as unknown as Response
  })
  return { fetcher: fetcher as unknown as typeof fetch, calls }
}

describe('esc：取数面（浏览器只打同源固定路径）', () => {
  it('六个方法都打 POST /esc/read，正文关闭键集恰好 {path, params}，且 params 里没有 undefined 键', async () => {
    const envelope = { code: '0000', data: [{ id: 1, name: '空间' }] }
    const { fetcher, calls } = fakeFetcher({ data: envelope })
    const api = createEnterpriseEscApi(fetcher)
    await api.spaceList()
    expect(ENTERPRISE_ESC_READ_LOCAL_PATH).toBe('/esc/read')
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/esc/read')
    expect(calls[0]!.init?.method).toBe('POST')
    expect(calls[0]!.init?.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ path: '/api/space/list', params: {} })
    // undefined 的键在序列化前被摘掉（"缺席"这件事两侧一致）
    const { fetcher: f2, calls: c2 } = fakeFetcher({ data: envelope })
    await createEnterpriseEscApi(f2).publishedAgentList({ page: 1, kw: undefined, official: true })
    expect(JSON.parse(String(c2[0]!.init?.body))).toEqual({
      path: '/api/published/agent/list',
      params: { page: 1, official: true },
    })
  })

  it('六个方法各自的平台路径与返回（信封原样交回，不投影）', async () => {
    const cases: readonly [string, (api: EnterpriseEscApi) => Promise<unknown>, string][] = [
      ['publishedCategoryList', api => api.publishedCategoryList(), '/api/published/category/list'],
      ['spaceList', api => api.spaceList(), '/api/space/list'],
      ['publishedAgentList', api => api.publishedAgentList({ page: 1 }), '/api/published/agent/list'],
      ['publishedSkillList', api => api.publishedSkillList({ page: 1 }), '/api/published/skill/list'],
      ['publishedSkillEnableList', api => api.publishedSkillEnableList({}), '/api/published/skill/enable/list'],
      ['connectorProviderPageList', api => api.connectorProviderPageList({ pageNum: 1 }), '/api/connector/providers'],
    ]
    for (const [name, run, expectedPath] of cases) {
      const envelope = { code: '0000', message: 'ok', data: [], success: true }
      const { fetcher, calls } = fakeFetcher({ data: envelope })
      const result = await run(createEnterpriseEscApi(fetcher))
      expect(JSON.parse(String(calls[0]!.init?.body))['path'], name).toBe(expectedPath)
      // message/success 两格也在：页面读 `res.message`，投影掉就会与原文行为分叉
      expect(result, name).toEqual(envelope)
    }
  })

  it('本机失败体里的稳定码原样抛出；本机信封不合形 ⇒ ENT_LOCAL_RESPONSE_INVALID', async () => {
    const denied = fakeFetcher({ error: { code: 'ENT_AUTH_REQUIRED' } }, { ok: false, status: 401 })
    await expect(createEnterpriseEscApi(denied.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_AUTH_REQUIRED',
    })
    // `{data}` 里没有平台信封（没有 code）⇒ 本地判畸形
    const malformed = fakeFetcher({ data: { message: 'no code' } })
    await expect(createEnterpriseEscApi(malformed.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
    // 顶层不是对象
    const notObject = fakeFetcher('nope')
    await expect(createEnterpriseEscApi(notObject.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
  })
})

/** 假取数面：六个方法都记账，返回测试给的信封。 */
function spyApi(envelope: { code: string; data?: unknown } = { code: '0000', data: {} }) {
  const calls: { readonly method: string; readonly params: unknown }[] = []
  const record = (method: string) => async (params: unknown) => {
    calls.push({ method, params })
    return envelope as never
  }
  const api: EnterpriseEscApi = {
    publishedCategoryList: record('publishedCategoryList') as EnterpriseEscApi['publishedCategoryList'],
    spaceList: record('spaceList') as EnterpriseEscApi['spaceList'],
    publishedAgentList: record('publishedAgentList') as EnterpriseEscApi['publishedAgentList'],
    publishedSkillList: record('publishedSkillList') as EnterpriseEscApi['publishedSkillList'],
    publishedSkillEnableList: record('publishedSkillEnableList') as EnterpriseEscApi['publishedSkillEnableList'],
    connectorProviderPageList: record('connectorProviderPageList') as EnterpriseEscApi['connectorProviderPageList'],
    // 信息性的开关状态：这里回"没开"，故所有既有用例的渲染路径与真实部署逐字相同
    escMockStatus: async () => ({ enabled: false }),
  }
  return { api, calls }
}

describe('esc：适配器口径（各资源类型 × 数据源的参数差异）', () => {
  it('专家：系统广场仅官方 + ChatBot 子类型；团队空间 category=Agent + justReturnSpaceData 且不传 official', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.expert.system!
    const team = adapters.expert.team!
    if (system.mode !== 'server' || team.mode !== 'server') throw new Error('expert 两维都应是服务端分页')
    await system.fetchPage({ page: 2, pageSize: 20, category: '办公', keyword: '报表', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({
      page: 2,
      pageSize: 20,
      category: '办公',
      kw: '报表',
      targetType: 'Agent',
      targetSubType: 'ChatBot',
      official: true,
    })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: [7, 8] })
    expect(calls[1]!.params).toEqual({
      page: 1,
      pageSize: 20,
      kw: undefined,
      category: 'Agent',
      justReturnSpaceData: true,
      spaceIds: [7, 8],
    })
    // 单元素聚合回退成 spaceId；空格子用 spaceId；两者都没有则都不传
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: [7] })
    expect(calls[2]!.params).toMatchObject({ spaceId: 7 })
    expect(calls[2]!.params).not.toHaveProperty('spaceIds')
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: 9, spaceIds: undefined })
    expect(calls[3]!.params).toMatchObject({ spaceId: 9 })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[4]!.params).not.toHaveProperty('spaceId')
    expect(calls[4]!.params).not.toHaveProperty('spaceIds')
  })

  it('技能：系统广场仅官方；团队空间 category=Skill；「我启用的」是全量接口（无参数）且本地筛选', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.skill.system!
    const team = adapters.skill.team!
    const enabled = adapters.skill.enabled!
    if (system.mode !== 'server' || team.mode !== 'server' || enabled.mode !== 'client') throw new Error('技能三维的形状不对')
    await system.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 20, category: '', kw: undefined, official: true })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: 7, spaceIds: undefined })
    expect(calls[1]!.params).toMatchObject({ category: 'Skill', justReturnSpaceData: true, spaceId: 7 })
    await enabled.fetchAll({ spaceId: undefined, keyword: 'x', category: 'y' })
    expect(calls[2]!.params).toEqual({})
    // serverKeyword/serverCategory 都**没有**置位 ⇒ 本地必须自己按关键字与分类收窄
    expect(enabled.serverKeyword ?? false).toBe(false)
    expect(enabled.serverCategory ?? false).toBe(false)
  })

  it('连接器：官方目录 scope=official；空间维度 scope=space；已连接的/我启用的各带一个服务端筛选且本地跳过双重收窄', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.connector.system!
    const team = adapters.connector.team!
    const connected = adapters.connector.connected!
    const enabled = adapters.connector.enabled!
    if (system.mode !== 'server' || team.mode !== 'server' || connected.mode !== 'client' || enabled.mode !== 'client') {
      throw new Error('连接器四个维度的形状不对')
    }
    await system.fetchPage({ page: 3, pageSize: 20, category: '通讯工具', keyword: 'oss', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({
      pageNum: 3,
      pageSize: 20,
      scope: 'official',
      category: '通讯工具',
      keyword: 'oss',
    })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: 'oss', spaceId: 7, spaceIds: undefined })
    expect(calls[1]!.params).toEqual({ pageNum: 1, pageSize: 20, scope: 'space', spaceId: 7, keyword: 'oss' })
    // 「全部」页签：连接器**不带** spaceId 也要发（scope=space 聚合全部空间）
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[2]!.params).not.toHaveProperty('spaceId')
    await connected.fetchAll({ spaceId: undefined, keyword: 'k', category: 'c' })
    expect(calls[3]!.params).toEqual({ connected: 'true', category: 'c', keyword: 'k' })
    expect(connected.serverKeyword).toBe(true)
    expect(connected.serverCategory).toBe(true)
    await enabled.fetchAll({ spaceId: undefined, keyword: 'k', category: 'c' })
    expect(calls[4]!.params).toEqual({ connectionEnabled: 'true', category: 'c', keyword: 'k' })
    expect(enabled.serverKeyword).toBe(true)
    expect(enabled.serverCategory).toBe(true)
  })

  it('响应提取：已发布按 current<pages 判有无更多；连接器按"本页取满"判（它没有总页数）', () => {
    const { api } = spyApi()
    const adapters = escResourceAdapters(api)
    const published = adapters.expert.system!
    const connector = adapters.connector.system!
    if (published.mode !== 'server' || connector.mode !== 'server') throw new Error('形状不对')
    const page = {
      code: '0000',
      data: {
        records: [
          { id: 11, targetId: 101, name: '专家甲', statistics: { userCount: 3, convCount: 4, collectCount: 5 } },
        ],
        current: 1,
        pages: 3,
      },
    }
    const extracted = published.extract(page, 1, 20)
    expect(extracted.hasMore).toBe(true)
    expect(extracted.items[0]).toMatchObject({
      id: 'agent-11',
      agentId: 101,
      name: '专家甲',
      stats: [
        { type: 'user', value: 3 },
        { type: 'link', value: 4 },
        { type: 'star', value: 5 },
      ],
    })
    // 技能前缀只填 skillId，不填 agentId（原文件的判据）
    const skill = published.extract({ code: '0000', data: { records: [{ id: 12, targetId: 202, name: '技能乙' }], current: 1, pages: 1 } }, 1, 20)
    expect(skill.items[0]).toMatchObject({ skillId: undefined, agentId: 202 })
    expect(skill.hasMore).toBe(false)
    // 连接器：本页取满即认为还有下一页
    const full = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, service: `s${index}`, displayName: `S${index}` }))
    expect(connector.extract({ code: '0000', data: { records: full, pageNum: 1 } }, 1, 20).hasMore).toBe(true)
    expect(connector.extract({ code: '0000', data: { records: full.slice(0, 5), pageNum: 1 } }, 1, 20).hasMore).toBe(false)
    expect(connector.extract({ code: '0000', data: { records: full, pageNum: 2 } }, 1, 20).hasMore).toBe(false)
    // 连接器卡片名：displayName 优先、service 兜底；id 用 service
    const connectorSliced = { code: '0000', data: { records: [{ id: 9, service: 'aliyun_oss', displayName: 'OSS' }], pageNum: 1 } }
    expect(connector.extract(connectorSliced, 1, 20).items[0]).toMatchObject({
      id: 'system-conn-aliyun_oss',
      name: 'OSS',
      service: 'aliyun_oss',
    })
  })
})

describe('esc：二级分类投影', () => {
  const tree: readonly EscCategoryNode[] = [
    { key: 'Agent', label: '智能体', type: 'Agent', children: [{ key: '办公', label: '办公' }, { key: '', label: '空键要滤掉' }] },
    { key: 'Skill', label: '技能', type: 'Skill', children: [{ key: '数据', label: '数据' }] },
    { key: 'Connector', label: '连接器', type: 'Connector', children: [{ key: '通讯工具', label: '通讯工具' }] },
  ]

  it('专家/技能按根节点 type 取 children，并滤掉空 key', () => {
    expect(escCategoryChildrenOf(tree, 'Agent')).toEqual([{ key: '办公', label: '办公' }])
    expect(escCategoryChildrenOf(tree, 'Skill')).toEqual([{ key: '数据', label: '数据' }])
  })

  it('连接器按根节点 key=Connector 取（`rootType` 为 undefined 即此路）', () => {
    expect(escCategoryChildrenOf(tree, undefined)).toEqual([{ key: '通讯工具', label: '通讯工具' }])
  })

  it('label 缺席时回落到 key；树为空/根节点找不到时回空数组（不抛）', () => {
    expect(escCategoryChildrenOf([{ key: 'Agent', type: 'Agent', children: [{ key: 'X' }] }], 'Agent')).toEqual([
      { key: 'X', label: 'X' },
    ])
    expect(escCategoryChildrenOf(undefined, 'Agent')).toEqual([])
    expect(escCategoryChildrenOf(tree, 'NoSuchType')).toEqual([])
  })
})

/** 用户裁决的版式改动（左栏撤掉改顶部药丸页签、药丸不描边、卡片紧凑、卡片可见边框）——锁在这里，免得日后被"顺手改回去"。 */
describe('esc：用户裁决的版式（左栏撤掉改顶部药丸页签、卡片紧凑、卡片有边框）', () => {
  interface PillElement {
    readonly props: { readonly active: boolean; readonly className: string; readonly children: readonly unknown[]; readonly onClick: () => void }
  }

  /** 取出 `EnterpriseEscStyle` 里那串 CSS（它是纯字符串，故能直接断言规则文本）。 */
  const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children

  /**
   * 本页字号的**唯一合法形态**（本刀起）：`calc(<基准>px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px))`。
   * 写成函数而不是直接把字符串写进断言，是为了让每条字号断言**同时**锁住两件事：
   *   ① 基准值（视觉层级）；② 必须带**两个** delta（跟随壳「字体大小」设置 + 移动档视口自适应）——少一个就红。
   */
  const fsValue = (base: string): string =>
    `calc(${base}px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px))`
  const fs = (base: string): string => `font-size: ${fsValue(base)};`

  /** 取某个选择器对应规则的**声明体**（`{ … }` 之间的原文），供逐条断言。 */
  const ruleBody = (head: string): string => {
    const hit = new RegExp(`${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)
    expect(hit, head).not.toBeNull()
    return hit![1]!
  }

  it('三个菜单渲染成页签：顺序/文案来自兜底菜单，选中项带 active，重复点当前项也回调', () => {
    const onSelect = vi.fn()
    const element = EnterpriseEscResourceTabs({ activeKey: 'skill', onSelect }) as unknown as {
      readonly props: { readonly children: readonly PillElement[] }
    }
    const pills = element.props.children
    expect(pills).toHaveLength(3)
    expect(pills.map(pill => pill.props.active)).toEqual([false, true, false])
    expect(pills.map(pill => pill.props.className)).toEqual([
      'esc-resource-tab esc-pill',
      'esc-resource-tab esc-pill',
      'esc-resource-tab esc-pill',
    ])
    expect(pills.map(pill => (pill.props.children[1] as { props: { children: string } }).props.children)).toEqual([
      '专家',
      '技能',
      '连接器',
    ])
    // 点非当前项 ⇒ 切过去；点当前项 ⇒ **也**回调一次（原文 `_t` 令牌同义：整区 remount 重拉）
    pills[0]!.props.onClick()
    pills[1]!.props.onClick()
    expect(onSelect.mock.calls).toEqual([['expert'], ['skill']])
  })

  it('样式层：没有左栏规则、有页签行；药丸压掉官方选中态的描边环', () => {
    expect(css).not.toContain('.esc-sidebar')
    expect(css).not.toContain('.esc-menu-item')
    expect(css).toContain('.esc-resource-tabs {')
    // 官方 Pill 选中态是 `box-shadow: inset 0 0 0 1px …`；这里用两条类的选择器压掉（不靠 !important、不靠加载顺序）
    expect(css).toContain('.esc-root .esc-pill { box-shadow: none; }')
  })

  it('样式层：卡片几何**一比一还原官方** + 1px 可见边框（最新裁决；被撤回的紧凑档做反向锁）', () => {
    // 官方逐值：栅格 300px/16px、卡片 170px（无统计行 130px）、内衬 16px、卡内间距 16px、头行 12px、
    // 图标 48px、标题 16px/20px、描述 16px 行高 + 32px 两行、页脚 24px、统计间距 16px
    // ★用户裁决「完全按 SPEC」：网格 262/12（SPEC §4.1）、卡片间距 12、内衬 16px 20px（SPEC §4.2）
    // ★用户裁决（本轮，真机）覆盖了上面那条 170px 定高：卡片改由**内容**决定高度（见下一个用例）。
    // ★**口径 39**（用户裁决「平板下最少两列，只有手机竖屏才一列」）：列模板不再是各写一条的
    //   `repeat(auto-fill, minmax(262px, 1fr))`（那条要 536px 才排两列 ⇒ 横屏内容区 532px 掉成单列），
    //   改成两条网格**共用**的真源 `--esc-grid-cols`（真源本身的算式与两档实测见下一个用例）。
    expect(css).toContain('grid-template-columns: var(--esc-grid-cols)')
    expect(css).toMatch(/\.esc-list-section \{[^}]*gap: 12px/)
    expect(css).toMatch(/\.esc-card \{[^}]*gap: 12px; padding: 16px 20px;/)
    expect(css).toMatch(/\.esc-card \{[^}]*min-height: 84px;/)
    expect(css).toContain('.esc-card-compact { min-height: 84px; }')
    expect(css).toMatch(/\.esc-card-header \{[^}]*gap: 12px/)
    // ★用户裁决「完全按 SPEC」§4.3：图标 **28×28 正圆**、标题 **14.5px/650/line-height1.4**、
    //   描述 **12px/line-height1.6/两行截断/min-height 38px**、统计行 **11px/gap10/图标 opacity .7**
    // ★真图实测：图标是 **40px 圆角方块**（radius 10），不是 SPEC 文字写的 28 正圆
    expect(css).toMatch(/\.esc-card-image \{[^}]*width: 40px; height: 40px; border-radius: 10px;/)
    expect(ruleBody('.esc-card-title')).toContain(fs('14.5'))
    expect(css).toMatch(/\.esc-card-title \{[^}]*font-weight: 650;[^}]*line-height: 1.4;/)
    expect(css).toMatch(/\.esc-card-content \{[^}]*line-height: 16px; height: 32px/)
    expect(ruleBody('.esc-tag')).toContain(fs('11'))
    expect(css).toMatch(/\.esc-tag svg \{ opacity: \.7; \}/)
    expect(css).toContain('.esc-card-footer { height: 24px;')
    expect(css).toMatch(/\.esc-count-box \{[^}]*gap: 10px/)
    // 收藏回右下角绝对定位、命中区 32px；动作位回右上角绝对定位（top 12 / right 16）
    expect(css).toContain('.esc-corner-box { position: absolute; right: 16px; bottom: 12px;')
    expect(css).toMatch(/\.esc-star-box \{[^}]*width: 32px; height: 32px;/)
    expect(css).toMatch(/\.esc-action-box \{ position: absolute; top: 12px; right: 16px;/)
    // hover 浮现：官方那枚 `.hover-reveal-btn` 挂不上 dsh 的 Button（`:disabled{opacity:.4}` 0,2,0 压单类），
    // 故由外层 span 承载 —— 这条选择器必须留着，否则按钮会一直可见、压在标题上。
    expect(css).toContain('.esc-hover-reveal { opacity: 0; pointer-events: none;')
    expect(css).toContain('.esc-card:hover .esc-hover-reveal { opacity: 1; pointer-events: auto; }')
    // 反向锁：被"一比一还原"撤掉的那几档（紧凑几何 / 常驻动作位内缩 / 收藏上移 / 页脚不留白）不许回归
    expect(css).not.toContain('.esc-card-compact { height: 104px; }')
    expect(css).not.toContain('.esc-card-compact { height: 96px; }')
    expect(css).not.toContain('esc-card-pinned')
    expect(css).not.toMatch(/\.esc-star-box \{[^}]*width: 22px/)
    expect(css).not.toContain('.esc-card-footer { min-height: 0;')
    // 边框：从 `.5px` 发丝线换成 `1px` 可见边框（用户先前明确要过），hover 只换颜色（不换宽度 ⇒ 无布局抖动）
    expect(css).toContain('border: 1px solid var(--dsw-alias-border-l2)')
    expect(css).not.toContain('.5px solid var(--dsw-alias-stroke-border-2)')
  })

  it('样式层（本轮两条真机裁决）：卡片去定高去顶底留白 + 一二级分类标签收一档', () => {
    // ① 「技能卡片中间空白太多，去除空白行」：那条空白是**声明出来的**——
    //    `height: 170px` 定高 + 标签行的 `margin-top: auto` 一起把标签行顶到卡底。
    expect(css).toContain('.esc-card-skill { height: auto; }')
    expect(css).not.toMatch(/\.esc-card-skill \{[^}]*height: 170px/)
    expect(css).not.toMatch(/\.esc-card-tags \{[^}]*margin-top: auto/)
    // 反向锁：卡片仍要有底（min-height 84px 不许被顺手删掉），标签行仍要贴住内容那一格
    expect(css).toMatch(/\.esc-card \{[^}]*min-height: 84px;/)
    expect(css).toMatch(/\.esc-card-tags \{[^}]*padding-top: 6px;/)
    // ② 「一级二级分类标签再小一号」：两级同挂 `.esc-category-tabs .esc-pill`（渲染点只有一处）
    expect(ruleBody('.esc-category-tabs .esc-pill')).toContain(fs('13'))
    expect(ruleBody('.esc-category-tabs .esc-pill')).not.toContain(fs('14'))
    // 反向锁：只收字号这一档——行高/字重/选中灰底都不许被顺手改
    //   ★本刀例外：那一刀的"间距也不许动"被**新的用户裁决**取代了（「全部那行分类标签之间间距紧凑些」），
    //     gap 20px → 8px 见下一处断言；除 gap 外的反向锁原样留着。
    expect(css).toMatch(/\.esc-category-tabs \.esc-pill \{[^}]*font-weight: 500;/)
    expect(css).toContain(".esc-category-tabs .esc-pill[data-esc-selected='true'] { background: var(--dsw-alias-interactive-bg-hover);")
    expect(css).toMatch(/\.esc-category-tabs \{[^}]*gap: 8px;/)
    // 源码级锁：两级的渲染点只有一处，故"一档改完两级同时生效"这句话成立
    const toolbarSource = readFileSync(new URL('../src/esc/esc-toolbar.tsx', import.meta.url), 'utf8')
    expect(toolbarSource.match(/esc-category-tabs/g) ?? []).toHaveLength(1)
  })

  it('样式层（本刀）：字号一律接壳的字体缩放 + 移动档视口自适应（不许再出现裸 px 字号）', () => {
    // 壳的真源：布局层把用户「字体大小」设置写成 --dsh-content-font-size: Npx，
    // 主题层再由它派生一条**加法** delta：body{--dsh-content-font-delta:calc(var(--dsh-content-font-size,14px) - 14px)}
    // ⇒ 壳内每个组件都写 calc(基准px + var(--dsh-content-font-delta, 0px))。本页原先 27 处字号全是硬编码 px，
    // 是壳里唯一"不跟随字体设置"的一块，本刀接上，并叠一档 --esc-fs-delta（移动档视口自适应）。
    // ① 桌面档 delta 为 0 ⇒ 桌面像素观感与本刀之前一致（壳那一路仍然生效）
    expect(ruleBody('.esc-root')).toContain('--esc-fs-delta: 0px')
    // ② 移动档把它换成一条 clamp 的视口函数（100vmin：宽高里较小的一维；横竖屏都不会反向）
    const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)
    expect(mobile, '移动档').not.toBeNull()
    expect(mobile![1]).toContain('--esc-fs-delta: clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px)')
    // ③ ★门禁本体：全份 CSS **不许有裸 px 字号**——每一处都必须是"基准 + 两个 delta"的 calc 形态。
    //    这条同时防两件事：新写的规则退回硬编码；以及有人"顺手简化"把某个 delta 去掉。
    // ★先剥注释再扫：注释里引述"旧写法长什么样"是正常的（本刀注释里就写了），
    //   不剥的话门禁会被自己的注释骗红——那会逼着后人把注释写含糊。
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const bare = declarations.match(/font-size: [0-9.]+px;/g) ?? []
    expect(bare, `裸 px 字号：${bare.join(' ')}`).toEqual([])
    // 逐个抽样：三档字号都在（小字/正文/大字），且都带两个 delta（`fs()` 就是那条唯一合法形态）
    expect(ruleBody('.esc-scroll-loader')).toContain(fs('12'))
    expect(ruleBody('.esc-tag')).toContain(fs('11'))
    expect(ruleBody('.esc-card-title')).toContain(fs('14.5'))
    expect(ruleBody('.esc-resource-tab')).toContain(fs('18'))
    // 反向锁：delta 必须是**加法**（乘法会破坏层级：11px 与 18px 不能按比例一起放大）
    expect(css).not.toMatch(/font-size: calc\([0-9.]+px \*/)
    // 反向锁：页面的字号不许自带媒体档二次声明（唯一真源仍是各规则本体 + 那两个 delta）
    expect(declarations.match(/font-size/g) ?? []).toHaveLength(27)
  })

  it('样式层（本刀）：「精选」上下间距调大到同值（上 20 = 精选自身 6 + 维度行 14）', () => {
    // 结构事实（esc-toolbar.tsx）：工具栏里三行依次是 .esc-toolbar-row（三页签）→ .esc-toolbar-second（精选）
    // → .esc-source-tabs（维度），而 .esc-toolbar 是**普通块容器、行间没有 gap** ⇒ 原先"精选与上方"= 0px
    //（两行直接贴死，正是"太挤"的来处），"精选与下方"= 8 + 14 = 22px。
    // 用户原话「精选和上方间距调大，上下间距一样」⇒ 两个数取同一个 20：
    //   上 = .esc-toolbar-second 的 margin-top
    //   下 = .esc-featured 的 padding-bottom + .esc-source-tabs 的 margin-top（那 14px 是官方值，且连接器页
    //        没有精选行时它就是唯一的上间距，故不挪它，改精选那一侧）
    const num = (re: RegExp): number => Number(re.exec(css)?.[1])
    const above = num(/\.esc-toolbar-second \{[^}]*margin-top: ([0-9]+)px;/)
    const featuredBottom = num(/\.esc-featured \{[^}]*padding-bottom: ([0-9]+)px;/)
    const sourceTop = num(/\.esc-source-tabs \{[^}]*margin-top: ([0-9]+)px;/)
    expect([above, featuredBottom, sourceTop]).toEqual([20, 6, 14])
    // ★门禁是"上下相等"这条不变量本身（不是把两个 20 硬写两遍）
    expect(above).toBe(featuredBottom + sourceTop)
    // 反向锁：上方不许退回贴死（0），也不许反而比下方小——两种都是"回到用户抱怨的那个样子"
    expect(above).toBeGreaterThan(0)
    expect(above).toBeGreaterThanOrEqual(featuredBottom + sourceTop)
  })

  it('样式层（本轮真机裁决）：顶部两行标签同收一档到 18px，且两行继续逐值相等', () => {
    // 用户原话「专家技能连接器和系统广场，工作空间小一号」⇒ **两行各收一档**（两处原本都是 20px）：
    //   行① 专家/技能/连接器  → `.esc-resource-tab`
    //   行② 系统广场/团队空间/我启用的 → `.esc-source-tabs .esc-pill`
    expect(ruleBody('.esc-resource-tab')).toContain(fs('18'))
    expect(ruleBody('.esc-source-tabs .esc-pill')).toContain(fs('18'))
    // 反向锁①：20px 那一档不许回来（两处都锁，只锁一处会留半条退路）
    expect(ruleBody('.esc-resource-tab')).not.toContain(fs('20'))
    expect(ruleBody('.esc-source-tabs .esc-pill')).not.toContain(fs('20'))
    // 反向锁②：两行是**同一套视觉语言** ⇒ font-size / font-weight / line-height 逐值相等。
    //   判据是"提取后比对"，不是"两边各写一条 toMatch"——后者在任何一处被单独改掉时仍会绿。
    const body = (head: string): string => {
      const hit = new RegExp(`${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)
      expect(hit, head).not.toBeNull()
      return hit![1]!
    }
    const triplet = (head: string): readonly (string | undefined)[] =>
      ['font-size', 'font-weight', 'line-height'].map(prop => new RegExp(`${prop}: ([^;]+);`).exec(body(head))?.[1])
    expect(triplet('.esc-resource-tab')).toEqual(triplet('.esc-source-tabs .esc-pill'))
    expect(triplet('.esc-resource-tab')).toEqual([fsValue('18'), '600', '1'])
    // 反向锁③：本刀**只收字号**——高度/字重/行高/容器间距一个都不许被顺手改（改了就是新裁决，得显式改这条）
    expect(css).toMatch(/\.esc-resource-tab \{[^}]*height: 32px;/)
    expect(css).toMatch(/\.esc-source-tabs \.esc-pill \{[^}]*height: 30px;/)
    expect(css).toMatch(/\.esc-resource-tabs \{[^}]*gap: 20px;/)
    expect(css).toMatch(/\.esc-source-tabs \{[^}]*gap: 20px;/)
    // 唯一真源：这两行的字号**各自只有一处声明**（若日后有媒体档再声明一次，手机上"小一号"会被悄悄覆盖）
    //   ★正则锚到行首（`m`）：不锚的话，上面那段**注释里提到过同一个选择器名**，会误配成第二处声明。
    expect(css.match(/^\.esc-resource-tab[^{]*\{[^}]*font-size/gm) ?? []).toHaveLength(1)
    expect(css.match(/^\.esc-source-tabs [^{]*\.esc-pill[^{]*\{[^}]*font-size/gm) ?? []).toHaveLength(1)
  })

  it('★口径 39（用户裁决「平板下最少两列，只有手机竖屏才一列」）：列模板走同一真源，532/560/1200 三档列数算得对', () => {
    // **这一条门禁盯的是一个 4px 的差**：真机（这台折叠屏，dpr = 440dpi ÷ 160 = 2.75）
    //   · 横屏 物理 2364×1672 ⇒ CSS 视口 860×608，且侧栏**停靠**（截图实测 ≈280）⇒ 内容区 532px；
    //   · 竖屏 物理 1672×2364 ⇒ CSS 视口 608×860，侧栏是抽屉（汉堡键）⇒ 内容区 560px。
    // 旧规则 `minmax(262px, 1fr)` 的门槛是 2×262 + 12 = **536px** ⇒ 竖屏 560 排两列、横屏 532 掉回
    // 一列——用户报的"横向一列、竖着两列"就是这 4px。新算式对 532 与 560 都必须给两列。
    // ① 两条网格（列表 + 精选）**逐字相同**且都取真源：列数一漂，精选行与下面那段就列不对齐
    const gridRules = [...css.matchAll(/\.(?:esc-list-section|esc-featured-grid) \{[^}]*\}/g)].map(hit => hit[0])
    expect(gridRules).toHaveLength(2)
    expect(gridRules.map(body => /grid-template-columns: ([^;]+);/.exec(body)?.[1])).toEqual([
      'var(--esc-grid-cols)',
      'var(--esc-grid-cols)',
    ])
    // ② 真源的默认档 = **手机竖屏** = 单列（用户原话里唯一该是一列的那一档）
    expect(ruleBody('.esc-root')).toContain('--esc-grid-cols: minmax(0, 1fr)')
    // ③ 非手机竖屏那一档的判据逐字就是那句话：宽度 > 560 **或** 横屏
    const tier = /@media \(min-width: 561px\), \(orientation: landscape\) \{([\s\S]*?)\n\}/.exec(css)
    expect(tier, '非手机竖屏那一档').not.toBeNull()
    // ④ 算式：min(262px, (100% - gap) / 2) —— 三个数都从 CSS 里**提取**出来比对，不在这儿重写一遍
    const formula = /--esc-grid-cols: repeat\(auto-fill, minmax\(min\(([0-9]+)px, calc\(\(100% - ([0-9]+)px\) \/ ([0-9]+)\)\), 1fr\)\)/.exec(tier![1]!)
    expect(formula, '列模板算式').not.toBeNull()
    const base = Number(formula![1])
    const formulaGap = Number(formula![2])
    const divisor = Number(formula![3])
    const cssGap = Number(/\.esc-list-section \{[^}]*gap: ([0-9]+)px;/.exec(css)?.[1])
    // 算式里那个 gap 必须**等于**两条网格的 gap：抄错一个数，列数就会在某个宽度上悄悄掉一列
    expect([base, divisor, formulaGap]).toEqual([262, 2, cssGap])
    // ⑤ 用 auto-fill 的定义把列数算出来（min = min(base, (W - gap) / divisor)）：
    //    横屏 532 与竖屏 560 都 ≥ 2（**这两个数就是用户报的那两台姿态**），宽屏照旧随宽度长
    const columnsAt = (width: number): number => {
      const min = Math.min(base, (width - formulaGap) / divisor)
      return Math.floor((width + formulaGap) / (min + formulaGap))
    }
    expect([columnsAt(532), columnsAt(560), columnsAt(800), columnsAt(1200)]).toEqual([2, 2, 2, 4])
    // ⑥ **把故障本身钉住**：旧规则（硬编码 262px）在同一台设备的两个姿态上，横屏只有 1 列
    //    —— 这就是用户报的"横向一列、竖着两列"。它不写进 CSS、只活在这条门禁里：
    //    日后若有人把 `min()` 拆掉换回硬编码，上面那条 ⑤ 会红，这条会告诉他是"哪一台姿态塌了"。
    const columnsLegacy = (width: number): number => Math.floor((width + 12) / (262 + 12))
    expect([columnsLegacy(532), columnsLegacy(560)]).toEqual([1, 2])
    // ⑦ 反向锁：那条硬编码的 `minmax(262px, 1fr)`（536px 门槛的来源）不许回来。
    //    判据剥注释后扫——注释里引述旧写法是正常的（本用例上方与源文件里都写了）。
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('minmax(262px, 1fr)')
  })

  it('★口径 39（用户裁决「标题和描述加一起要和图标中间对齐」「标题不要和安装图标积压在一起」）：技能卡头行居中 + 动作位进流', () => {
    // ① 图标与「标题 + 描述」这一块**垂直居中**（只对技能卡；专家/连接器是三层版式，不动）
    expect(ruleBody('.esc-card-skill .esc-card-header')).toContain('align-items: center')
    // ② headmain 不再把内容上下撑开（space-between 是给专家卡那三层版式的），技能卡收成一块居中
    expect(ruleBody('.esc-card-skill .esc-card-headmain')).toContain('justify-content: center')
    // 反向锁：**通用**那条头行规则不许被改成居中（改了会连专家/连接器一起动，那是另一套版式）
    expect(ruleBody('.esc-card-header')).not.toContain('align-items: center')
    // ③ 动作位（+ / 更多 + 去试试）进流：不再绝对定位——它是"压在标题上"的根因
    const actions = ruleBody('.esc-skill-actions')
    expect(actions).not.toContain('position: absolute')
    expect(actions).toContain('flex: none')
    // 标题那一格必须仍可收缩（min-width: 0），否则 flex 分配不到宽度、省略号不生效
    expect(ruleBody('.esc-card-headmain')).toContain('min-width: 0')
    // ④ 源码级锁：动作位挂在**头行**里（结构改动，不是靠 CSS 调出来的）——「图标 | 标题/描述 | 动作」
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    const headerBlock = /'esc-card-header'([\s\S]*?)\n    \),/.exec(cardSource)
    expect(headerBlock, '头行那段').not.toBeNull()
    expect(headerBlock![1]).toContain('skillActionBox')
    // 反向锁：动作位不许再作为**卡片直属子节点**出现（两处都挂就会画两枚「+」）
    expect(cardSource.match(/^\s*skillActionBox,$/gm) ?? []).toHaveLength(0)
  })

  it('样式层（口径 35）：原子对齐官方的五条 + 三条失效 token 的反向锁', () => {
    // ① box-sizing：官方跑在 antd/umi 的全局 `* { box-sizing: border-box }` 下，dsh 壳没有这条。
    //    少了它卡片按 content-box 渲染（实测 204/164 而非 170/130），紧凑卡片还把描述挤掉半行。
    expect(css).toContain('.esc-root, .esc-root *, .esc-root *::before, .esc-root *::after { box-sizing: border-box; }')
    // ② 逐值补齐官方：内容区内衬 16/24（官方 index.less:12）、工具栏下边距 16（ResourceToolbar:6）、
    //    分类行上边距 14（:41）、头像 16（AuthorInfo .avatar）、作者名行高 16
    expect(css).toMatch(/\.esc-content \{[^}]*padding: 16px 24px;/)
    expect(css).toMatch(/\.esc-toolbar \{[^}]*margin-bottom: 16px;/)
    expect(css).toMatch(/\.esc-category-tabs \{[^}]*margin-top: 14px;/)
    expect(css).toMatch(/\.esc-author-avatar \{[^}]*width: 16px; height: 16px;/)
    expect(css).toMatch(/\.esc-author-name \{[^}]*height: 16px; line-height: 16px;/)
    // ③ 描述补齐官方 `text-ellipsis-2` 那三条 + `flex: none`（描述不许被压扁——它正是被压扁的那一格）
    expect(css).toMatch(/\.esc-card-content \{[^}]*text-overflow: ellipsis; word-break: break-all; white-space: normal; flex: none;/)
    expect(css).toMatch(/\.esc-card-header \{[^}]*flex: none;/)
    expect(css).toMatch(/\.esc-card-footer \{[^}]*flex: none;/)
    // ④ ★**用户裁决⑨ 覆盖了官方那一档**：hover 改成**背景变浅灰、边框不变**（此前是「换主色描边 + 抬升阴影」，
    //    真机截图里那条主色描边过于抢眼）。判据随之改为：边框**保持不变**（回到 `border-l2`）、
    //    底色走主题里那枚中性 hover 面、且**不加**抬升阴影。
    // ★用户裁决⑧**再收一档**：灰更浅（`bg-layer-2`，比 `interactive-bg-hover` 淡一档），
    //   边框回到 `l1`（与静止态同色 ⇒ 视觉上只有底色在动），且过渡只走 `background-color .15s`
    //   （此前那条 `transition: all .3s` 会把 border/box-shadow 也算进去，hover 显得一顿一顿）。
    expect(css).toContain('.esc-card:hover { border-color: var(--dsw-alias-border-l1); background-color: var(--dsw-alias-interactive-bg-hover); box-shadow: var(--dsw-shadow-lv2); }')
    expect(css).toContain('transition: background .2s ease-out, box-shadow .2s ease-out, border-color .2s ease-out;')
    // 反向锁（**只针对卡片本体**）：`.esc-card` 那条 `transition: all .3s` 已被撤下——它把
    // border/box-shadow 也算进过渡，是 hover 发顿的根因。别处（如收藏角标）的那条不在裁决范围，不动。
    expect(css).not.toMatch(/\.esc-card \{[^}]*transition: all \.3s/)
    // 反向锁：主色描边那一档已被用户裁决撤下，不许悄悄回来
    expect(css).not.toContain('.esc-card:hover { border-color: var(--dsw-alias-brand-primary)')
    // ⑤ 加载态换成官方那枚 Loading（转圈 + 「加载中...」），骨架卡整条退场
    expect(css).toMatch(/\.esc-loading \{[^}]*color: var\(--dsw-alias-brand-primary\);/)
    expect(css).toContain('@keyframes esc-spin')
    expect(css).not.toContain('.esc-skeleton-card')
    expect(css).not.toContain('.esc-skeleton {')
    // ⑥ 三条**在 dsh 主题里不存在**的 token（失效 ⇒ 声明计算期无效）：hover 边框会回退成 currentColor
    //    （截图里的"黑边卡片"）、卡片底色/图标底色回退成透明。一律不许回归。
    expect(css).not.toContain('--dsw-alias-accent-primary')
    expect(css).not.toContain('--dsw-alias-background-primary')
    expect(css).not.toContain('--dsw-alias-background-secondary')
    // 官方那枚失效选择器不许回来（现在是 brand-primary）
    expect(css).not.toContain('.esc-card:hover { border-color: var(--dsw-alias-accent-primary); }')
    // ⑦ 全黑按钮（用户裁决「卡片选中显示的操作按钮的灰色，换成全黑按钮」）：灰来自原语那条
    //    `.button:disabled { opacity: .4 }`（原语 `.primary` 本来就是实底 = brand-primary：浅色近黑 /
    //    深色反相成近白）。只按回这口冲淡，**不写死颜色**（浅深两套主题各自成立）。
    expect(css).toContain('.esc-root .esc-action-solid:disabled { opacity: 1; }')
  })

  it('空态：官方那态是 antd `<Empty>`（插图 + 暂无数据）；dsh 无 Empty 原语 ⇒ 按 token 画等价插图，文案逐字', () => {
    expect(css).toMatch(/\.esc-empty-art \{[^}]*width: 64px; height: 64px;/)
    expect(ENTERPRISE_ESC_COPY.emptyData).toBe('暂无数据')
  })

  it('图片地址改写器：绝对 http(s) 换成本机代理；空/相对/非 http(s) 如实返回 undefined', () => {
    expect(ENTERPRISE_ESC_IMAGE_LOCAL_PATH).toBe('/esc/image')
    const raw = 'https://nuwax.example.com/api/logo/skill/flow-builder'
    expect(enterpriseEscImageSrc(raw)).toBe(
      `/enterprise/api/v1/local/esc/image?src=${encodeURIComponent(raw)}`,
    )
    for (const bad of [undefined, null, '', '/api/f/local/x.png', 'data:image/png;base64,AAA', 'javascript:alert(1)', 'not a url']) {
      expect(enterpriseEscImageSrc(bad), String(bad)).toBeUndefined()
    }
    // 第二个域的绝对地址**照样改写**：裁决在宿主（src origin 必须等于会话 origin），页面这一侧不做安全判断、也不猜域名。
    const foreign = 'https://evil.example.com/api/f/x.png'
    expect(enterpriseEscImageSrc(foreign)).toBe(
      `/enterprise/api/v1/local/esc/image?src=${encodeURIComponent(foreign)}`,
    )
  })
})

describe('esc：演示数据开关（口径 32）', () => {
  it('开关状态走 GET /esc/mock，开着时把被模拟的端点清单原样交回来', async () => {
    expect(ENTERPRISE_ESC_MOCK_LOCAL_PATH).toBe('/esc/mock')
    const { fetcher, calls } = fakeFetcher({
      data: { enabled: true, reason: 'enabled', endpoints: ['/api/connector/providers'] },
    })
    const status = await createEnterpriseEscApi(fetcher).escMockStatus()
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/esc/mock')
    expect(calls[0]!.init?.method).toBe('GET')
    // 与六个取数方法不同：这条不带正文，也不带 content-type
    expect(calls[0]!.init?.body).toBeUndefined()
    expect(status).toEqual({ enabled: true, reason: 'enabled', endpoints: ['/api/connector/providers'] })
  })

  it('★这条刻意不抛：没开 / 畸形 / 网络失败一律回 {enabled:false}（横幅不出现，页面不受影响）', async () => {
    const off = fakeFetcher({ data: { enabled: false, reason: 'absent', endpoints: [] } })
    await expect(createEnterpriseEscApi(off.fetcher).escMockStatus()).resolves.toEqual({
      enabled: false,
      reason: 'absent',
      endpoints: [],
    })
    // 本机路由 404（旧宿主还没重启）/ 正文不是对象 / 连 fetch 都抛：三种都当"没开"
    const missing = fakeFetcher('nope', { ok: false, status: 404 })
    await expect(createEnterpriseEscApi(missing.fetcher).escMockStatus()).resolves.toEqual({ enabled: false })
    const malformed = fakeFetcher({ data: '不是对象' })
    await expect(createEnterpriseEscApi(malformed.fetcher).escMockStatus()).resolves.toEqual({ enabled: false })
    const throwing = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    await expect(createEnterpriseEscApi(throwing).escMockStatus()).resolves.toEqual({ enabled: false })
  })

  it('★用户裁决（本轮）「模拟数据提示不要」：横幅整条撤掉——样式与词汇表里都不该再有它', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    expect(css).not.toContain('esc-mock-banner')
    expect(Object.keys(ENTERPRISE_ESC_LOCAL_COPY)).not.toContain('mockBannerTitle')
    expect(Object.keys(ENTERPRISE_ESC_LOCAL_COPY)).not.toContain('mockBannerBody')
    // 撤的是"页面上的提示"，不是机器可读的事实：`escMockStatus` 这条协议仍在（上面两条测试照旧盯着它）
  })

  it('★用户裁决「搜索栏动态自适应宽度，和系统广场和空间放一行」：自适应在同一行里完成（旧整行换行档已撤 · 口径 38 真机「不在一行」再关掉主行 wrap）', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // ① 药丸组不参与压缩、② 药丸里的字不折行 ⇒ 标签永不被挤压（上一轮口径，仍然保留）
    expect(css).toContain('.esc-source-tabs {')
    expect(css).toMatch(/\.esc-source-tabs \{[^}]*flex: none/)
    // ★用户裁决④：三页签作为**主行 leading 插槽**与右块同处一个 flex 行（结构改动，不是 CSS 调出来的）
    expect(css).toContain('.esc-toolbar-leading { flex: none;')
    // ★用户裁决（两栏结构）：第一栏一行、第二栏一行
    expect(css).toContain('.esc-toolbar-row { display: flex;')
    expect(css).toContain('.esc-toolbar-second {')
    expect(css).toMatch(/\.esc-pill \{ white-space: nowrap; \}/)
    // ③ ★**用户裁决②③ 撤掉了「自适应吃满剩余宽度」那一档**——真机截图里那枚搜索框几乎占满整行，
    //    与 workbuddy（约 200px、右对齐）差得最远。现在**定宽 200px**、窄屏收到 160px。
    expect(css).toMatch(/.esc-search {[^}]*width: 220px/)
    expect(css).toMatch(/\.esc-search \{[^}]*flex: none/)
    // 反向锁：`flex: 1 1 auto`（吃满剩余宽度）那一档已被用户裁决撤下，不许回来
    expect(css).not.toMatch(/\.esc-search \{[^}]*flex: 1 1 auto/)
    expect(css).not.toContain('flex: 0 1 214px')
    // ④ 右块**不再伸缩**（`margin-left: auto` 把它整体推到右边）——与主 tab 同一行、居右
    expect(css).toMatch(/\.esc-toolbar-right \{[^}]*flex: none/)
    expect(css).toMatch(/\.esc-toolbar-right \{[^}]*margin-left: auto/)
    expect(css).not.toMatch(/\.esc-toolbar-right \{[^}]*flex: 1 1 auto/)
    // ⑤ 反向锁：那条"搜索格整行占满"的窄屏档会把它挤到第二行，不许回来
    // （判据取"声明块里出现"：注释里为了记录历史可以写这串）
    expect(css).not.toMatch(/\{[^}]*flex: 1 1 100%/)
    // ★用户裁决②：定宽那一档的收窄档 —— 手机上 200px 会挤掉右块其余两枚，收到 160px（不是 96px 那种塌成缝）
    expect(css).toMatch(/@media \(max-width: 560px\) \{[\s\S]*\.esc-search \{ width: 160px; \}/)
    // ⑥ ★口径 38（真机截图「4 不在一行」）：主行**不换行** —— 手机宽度下 药丸组 + 右块 的 flex 基准
    //    之和（~140 + 24 + 搜索框 ~240）超过容器，`wrap` 会把右块整块顶到第二行；nowrap + 搜索框
    //    自身下限才能让"同一行 + 自适应"同时成立。
    expect(css).toMatch(/\.esc-toolbar-row \{[^}]*flex-wrap: nowrap/)
    expect(css).not.toMatch(/\.esc-toolbar-row \{[^}]*flex-wrap: wrap/)
    expect(css).not.toMatch(/\.esc-toolbar-row \{[^}]*row-gap/)
  })

  it('★用户裁决（本轮）两条：非选中页签深一档 · 移动端整页单滚动面', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // ① 「非选中的页签颜色深一点」：三行标签（三页签 / 维度 / 二级分类）的未选中色**同步**提到 tertiary。
    //    事实依据：dimmed 在浅色主题下是 `#e1e5ee`（≈12% 黑，几乎是白）——上一版注释把它当"50% 黑"是假话，
    //    真机上「专家/连接器」因此淡到快看不见。tertiary 在浅色是 `#adb2b8`、深色是 `#81858c`
    //    （深色主题下比 dimmed 的 `#43454a` 更亮）⇒ 两套主题都是"对比更强"这一个方向。
    expect(css).toContain(".esc-resource-tab:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }")
    expect(css).toContain(
      ".esc-source-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }",
    )
    expect(css).toContain(
      ".esc-category-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }",
    )
    // 反向锁：三行的未选中都不许退回 dimmed（退回去就是"又淡到看不见"）
    expect(css).not.toMatch(/:not\(\[data-esc-selected='true'\]\) \{ color: var\(--dsw-alias-label-dimmed\); \}/)
    // 选中仍是主文字色 —— 深一档只动"未选中"，不许顺手把选中一起改了
    expect(css).toMatch(/\.esc-resource-tab\[data-esc-selected='true'\] \{[^}]*color: var\(--dsw-alias-label-primary\);/)

    // ② 移动端：滚动面从「列表那口小格子」提到**内容区自身** ⇒ 工具栏/精选/维度/分类与卡片一起滚（全屏滚动）
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{/)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.esc-content \{ overflow-y: auto;/)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.esc-scroll \{ flex: none; min-height: 0; overflow: visible; \}/)
    // 反向锁：桌面档那两口"钉死工具栏 + 只有列表滚"的声明**不许被动**（动的只是 @media 里那一档）
    expect(css).toMatch(/\.esc-content \{[^}]*overflow: hidden; \}/)
    expect(css).toMatch(/\.esc-scroll \{ flex: 1; min-height: 0; overflow-y: auto; \}/)
    // 反向锁：判据不许退回"只看宽度"——本机真机 CSS 视口约 862×610（按那枚 220px 定宽搜索框反推 dpr≈2.74），
    // 宽 862 永远够不着 560px 档 ⇒ 那档对这台设备是死代码；`pointer: coarse` 与横竖屏无关，才是稳的判据。
    // （判据取「560px 那一档的**块内**」而不是整份 CSS：滚动面那条注释里本来就会写到 .esc-content）
    const narrowBlock = /@media \(max-width: 560px\) \{\n([\s\S]*?)\n\}/.exec(css)
    expect(narrowBlock).not.toBeNull()
    expect(narrowBlock?.[1]).not.toContain('.esc-content')

    // ③ 源码级：挪了滚动面 ⇒ 触底加载与「不满屏自动补拉」都得跟着挪
    //    （不跟着挪的两个后果：移动端触底不加载；以及一口气把所有页拉光——因为问错了 clientHeight）
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    expect(aggregation).toContain("{ className: 'esc-content', ref: boxRef, onScroll: handleScroll }")
    expect(aggregation).toContain('const activeScroller = useCallback')
    expect(aggregation).toContain('const scroller = activeScroller()')
    // ★本刀改写了这条：旧写法 `contentRef.current.scrollHeight <= scroller.clientHeight` 是"卡片区高度
    //   比滚动面视口高"——手机档滚动面是整页（工具栏/精选/维度/分类都在里面），卡片区只是它的一部分
    //   ⇒ 判据恒真、一路把页拉光。现在收进纯函数 `decideAutoFill`，问滚动面**自己**有没有溢出。
    expect(aggregation).toContain('const decision = decideAutoFill({')
    expect(aggregation).not.toContain('contentRef')
  })

  it('★本刀（真机故障「下滑加载中不起作用、会一直闪屏」）：两条判据必须问 hasMore、且问自己那个盒子', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // 现场读数（本轮探针打现役宿主，两个端点都测了）：
    //   /api/published/skill/list 与 /api/published/agent/list（official:true）
    //     page 1 ⇒ { records: 7, current: 1, pages: 1, total: 7 }
    //     page 2 ⇒ { records: [], current: 2, pages: 1 }   ← 平台**没有第 2 页**
    // ⇒ 提取后 hasMore=false（"响应提取"那条用例已锁）。可是旧代码的**触底入口从不问 hasMore**：
    //   手指一到底部（Android 在回弹/按压期间会**持续**发 scroll）就一遍遍发同一条取不到东西的请求，
    //   每次在列表末尾插一行「加载中…」再拆掉 ⇒ 用户看到的正是"加载不起作用 + 一直闪"。
    //   上一刀把滚动面提到的整页（用户裁决「不要冻结、支持全屏滚动」）之后手指才**够得着**这个触发点。

    // ① 触底判据：hasMore=false ⇒ 哪怕就贴在底部，也不许触发
    const bottom = { scrollHeight: 1000, scrollTop: 900, clientHeight: 100 }
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: false, loading: false, suppressed: false })).toBe(false)
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: false, suppressed: false })).toBe(true)
    // 80px 提前量照旧（原 InfiniteScroll 手感）：距底 80 触发、81 不触发
    expect(shouldTriggerBottomLoad({ scrollHeight: 1000, scrollTop: 820, clientHeight: 100, hasMore: true, loading: false, suppressed: false })).toBe(true)
    expect(shouldTriggerBottomLoad({ scrollHeight: 1000, scrollTop: 819, clientHeight: 100, hasMore: true, loading: false, suppressed: false })).toBe(false)
    // 在途不叠加；已停手（补拉无进展）也不再自动重试
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: true, suppressed: false })).toBe(false)
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: false, suppressed: true })).toBe(false)

    // ② 自动补拉判据：两个高度必须来自**同一个盒子**
    const fill = { scrollerScrollHeight: 610, scrollerClientHeight: 610, hasMore: true, loading: false, listLength: 7, previousLength: -1, suppressed: false }
    // 滚动面自己没东西可滚（610/610）⇒ 补一页
    expect(decideAutoFill(fill)).toBe('pull')
    // ★旧写法在这里误判：卡片区 400px ≤ 整页视口 610px ⇒ "不满屏"恒真。现在问滚动面自己：900 > 610 ⇒ 不补
    expect(decideAutoFill({ ...fill, scrollerScrollHeight: 900 })).toBe('idle')
    // ★补过一轮而列表**没长**（空页 / 同批页 / 请求失败）⇒ 上闩停手（否则每 100ms 一次，就是"一直闪"）
    expect(decideAutoFill({ ...fill, previousLength: 7 })).toBe('suppress')
    // 补过一轮且**长了**（真有多页）⇒ 继续补，这是正常无限滚动
    expect(decideAutoFill({ ...fill, listLength: 27, previousLength: 7 })).toBe('pull')
    // 没有下一页 / 在途 / 列表还空着 / 已闩 ⇒ 一律不补
    expect(decideAutoFill({ ...fill, hasMore: false })).toBe('idle')
    expect(decideAutoFill({ ...fill, loading: true })).toBe('idle')
    expect(decideAutoFill({ ...fill, listLength: 0, previousLength: -1 })).toBe('idle')
    expect(decideAutoFill({ ...fill, suppressed: true })).toBe('idle')

    // ③ 源码级反向锁：两个旧指纹都不许回来
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    // 触底入口必须走纯判据 —— 不许退回"只看离底多近就 loadMore()"（那条正是故障本体）
    expect(aggregation).toContain('shouldTriggerBottomLoad({')
    expect(aggregation).not.toMatch(/if \(el\.scrollHeight - el\.scrollTop - el\.clientHeight <= SCROLL_THRESHOLD_PX\) loadMore\(\)/)
    // 自动补拉必须走三态裁决，且**不许再引用卡片区**比高度（`contentRef` 已整条删除）
    expect(aggregation).toContain('decideAutoFill({')
    expect(aggregation).not.toContain('contentRef')
    // ④ 底部那行换成定高紧凑行：出现在滚动内容里，出现/消失不再把列表顶一下
    expect(aggregation).toContain("{ className: 'esc-scroll-loader', children: '加载中…' }")
    expect(aggregation).not.toContain("className: 'esc-state', children: '加载中…'")
    expect(css).toContain('.esc-scroll-loader { flex: none; height: 28px;')
    // ⑤ 取数层的第二道闸：`loadMore` 自己也要认 hasMore（两条入口共用这一道，新增调用点自动带上）
    const listSource = readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8')
    expect(listSource).toContain('if (loadingRef.current || !hasMoreRef.current) return')
    expect(listSource).toContain('hasMoreRef.current = hasMore')
  })

  it('★用户裁决（本轮）工具栏结构：药丸组挂 `esc-source-tabs`（样式层那条 no-shrink 规则的落点）', () => {
    const toolbar = EnterpriseEscToolbar({
      resourceType: 'expert',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
    }) as unknown as { readonly props: { readonly children: readonly { props: { className?: string } }[] } }
    // ★用户裁决（两栏结构）：第一栏是 `.esc-toolbar-row`（三页签 + 右块），维度标签与
    //   二级分类各自另起一行，精选在第二栏。children 含 null 槽位 ⇒ 先摘掉再断言。
    const classNames = toolbar.props.children
      .filter((node): node is { props: { className?: string } } => node !== null && node !== undefined)
      .map(node => node.props.className)
    expect(classNames).toContain('esc-toolbar-row')
    expect(classNames).toContain('esc-source-tabs')
    // ★二级分类**只在有分类时**才渲染（`categories.length > 0`）——本用例传的是空数组，故不该出现。
    expect(classNames).not.toContain('esc-category-tabs')
  })
})

describe('esc：卡片与工具栏的渲染树（口径 31 的「结构保真」侧）', () => {
  /** 一个最小的专家资源条目（只填断言要用的格子）。 */
  const expertItem = {
    id: 1,
    type: 'expert' as const,
    name: '示例专家',
    description: '示例描述',
    publishUser: { nickName: '张三' },
    collected: false,
    stats: [
      { type: 'user' as const, value: 3 },
      { type: 'star' as const, value: 7 },
    ],
  }
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    // React 的 createElement：**单个**子节点不会包成数组 ⇒ 一律归一化，免得断言按位置取值时踩这个坑
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  const card = (props: Record<string, unknown> = {}, itemOverride: Record<string, unknown> = {}) =>
    asElement(EnterpriseEscCard({ item: { ...expertItem, ...itemOverride } as never, ...props } as never))

  it('卡片结构照官方：头/描述/页脚三行落位；**页脚只在有统计行时才渲染**（口径 35③）', () => {
    const root = card({})
    // ★SPEC §7 分层策略：专家卡**无阴影** ⇒ 根类名多一枚 esc-card-expert（技能卡有、专家卡无）
    expect(root.props['className']).toBe('esc-card esc-card-expert')
    const [header, content, footer] = childrenOf(root)
    expect(asElement(header).props['className']).toBe('esc-card-header')
    const headMain = childrenOf(asElement(header))[1]!
    const title = childrenOf(asElement(headMain))[0]!
    expect(asElement(title).props['className']).toBe('esc-card-title')
    expect(asElement(title).props['children']).toBe('示例专家')
    expect(asElement(content).props['className']).toBe('esc-card-content')
    expect(asElement(content).props['children']).toBe('示例描述')
    // 页脚里只有统计行那一格（动作位/连接位/收藏位不在这里——它们与官方一样直接挂在卡片下）
    expect(childrenOf(asElement(footer)).map(node => (node === null ? null : asElement(node).props['className']))).toEqual([
      'esc-count-box',
    ])
    // 官方是 `{showStats && <footer/>}`：技能/连接器卡片**整格不渲染**（原先恒渲染 `esc-card-footer`
    // 24px + 16px 间隙，紧凑卡片因此内容超出 ⇒ flex-shrink 把描述压扁、第二行被切掉半截）
    expect(childrenOf(card({ showStats: false }))[2]).toBeNull()
    // 无统计行时整卡换成紧凑高度（用户裁决的几何：170 → 130）
    expect(card({ showStats: false }).props['className']).toBe('esc-card esc-card-compact')
  })

  it('统计行：星形图标跟随收藏态切实心（原文两处 collected 都生效）', () => {
    const statsOf = (collected: boolean) => {
      const root = card({}, { collected })
      const statsRow = childrenOf(childrenOf(root)[2]!)[0]!
      return childrenOf(asElement(statsRow)).map(node => childrenOf(asElement(node))[0])
    }
    const hollow = statsOf(false)
    const filled = statsOf(true)
    const fillOf = (node: unknown) => (asElement(node).props as { fill?: string }).fill
    expect(fillOf(hollow[1])).toBeUndefined()
    expect(fillOf(filled[1])).toBe('currentColor')
    // 非星形的两枚不受收藏态影响
    expect(fillOf(hollow[0])).toBe(fillOf(filled[0]))
  })

  it('★口径 40（用户裁决「技能底部的图标使用专家底部的图标，作者头像使用和专家一致的」）：技能卡底部与专家卡底部**共用同一套零件**', () => {
    // 判据不是"画出来的样子像"，而是**同一个函数引用**——版式可以随手改，这条锁不该跟着松：
    //   ① 技能标签行那三枚统计图标 ≡ 专家页脚那三枚（`statIconOf` 是唯一实现，星形实心跟随收藏态
    //      那条口径也因此不可能在两边分叉）；
    //   ② 技能标签行的作者 ≡ 专家卡头里的那枚 `AuthorRow`（连组件都是同一枚 ⇒ 真头像经同一条
    //      图片代理、破图退同一枚首字字母头像、名字同一套样式）。
    // ★另一条被就地钉住的旧口径：**项数与顺序都不许动**（作者 → 收藏量 → 安装量 → 使用量，
    //   用户裁决⑧）——这一刀只换"用哪几枚图标、作者怎么画"。
    const byClass = (element: Element, className: string): Element => {
      const found = childrenOf(element)
        .filter((node): node is Element => node !== null && node !== undefined && typeof node === 'object')
        .find(node => node.props['className'] === className)
      expect(found, `找不到 ${className}`).toBeTruthy()
      return found as Element
    }
    const nodesOf = (element: Element) =>
      childrenOf(element).filter((node): node is Element =>
        node !== null && node !== undefined && node !== false && typeof node === 'object')

    // —— ① 作者那一格
    const skillTags = byClass(card({ showUse: true }, {
      publishUser: { nickName: '张三', avatar: 'https://example.com/a.png' },
    }), 'esc-card-tags')
    const tagItems = nodesOf(skillTags)
    expect(tagItems).toHaveLength(4)
    const authorTag = tagItems[0]!
    expect(asElement(authorTag).props['className']).toBe('esc-tag esc-tag-author')
    // 整个作者格只有**一枚**子元素——原来那枚独用的 `User` 字形 + 名字的两格写法已撤下
    const authorChildren = childrenOf(asElement(authorTag))
    expect(authorChildren).toHaveLength(1)
    // 它和专家卡头里那枚是**同一个组件**（引用相等），且原样接住了这张卡自己的头像地址
    const expertHeadMain = childrenOf(childrenOf(card({ showSummon: true }))[0]!)[1]!
    const expertAuthor = nodesOf(asElement(expertHeadMain))
      .find(node => typeof node.type === 'function' && (node.props as { name?: string }).name === '张三')!
    expect(expertAuthor).toBeTruthy()
    expect(asElement(authorChildren[0]!).type).toBe(expertAuthor.type)
    expect(asElement(authorChildren[0]!).props['avatar']).toBe('https://example.com/a.png')
    expect(asElement(authorChildren[0]!).props['name']).toBe('张三')

    // —— ② 三枚统计图标：逐枚与**专家页脚自己渲染出来的**那三枚比 `type`（不重抄一份图标清单）
    const expertFooter = byClass(
      card({ showStats: true }, {
        stats: [
          { type: 'user', value: 1 },
          { type: 'link', value: 2 },
          { type: 'star', value: 3 },
        ],
      }),
      'esc-card-footer',
    )
    const expertIcons = childrenOf(byClass(expertFooter, 'esc-count-box')).map(node => childrenOf(asElement(node))[0])
    const skillIcons = tagItems.slice(1).map(node => childrenOf(asElement(node))[0])
    expect(skillIcons.map(node => asElement(node).type)).toEqual([
      asElement(expertIcons[2]).type, // 收藏量 ← 专家页脚的「收藏」（星形）
      asElement(expertIcons[0]).type, // 安装量 ← 专家页脚的「人数」（人形）
      asElement(expertIcons[1]).type, // 使用量 ← 专家页脚的「会话」（气泡）
    ])
    // 星形实心跟随收藏态：技能行这一枚也走同一枚实现（`collected === true` ⇒ `fill: currentColor`）
    const collectedTagRow = byClass(card({ showUse: true }, { collected: true }), 'esc-card-tags')
    expect((asElement(childrenOf(nodesOf(collectedTagRow)[1]!)[0]).props as { fill?: string }).fill).toBe('currentColor')
    // 安装 / 使用两格**照旧如实画缺口**（平台对技能不回 userCount/convCount，不许拿 0 顶上）
    expect(asElement(childrenOf(tagItems[2]!)[1]).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.statUnavailable)
    expect(asElement(childrenOf(tagItems[3]!)[1]).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.statUnavailable)
    // 顺序与语义仍是上一轮钉的那四格（作者 → 收藏 → 安装 → 使用）
    expect(tagItems.map(node => asElement(node).props['title'])).toEqual([
      '张三',
      ENTERPRISE_ESC_COPY.statCollect,
      ENTERPRISE_ESC_COPY.statInstall,
      ENTERPRISE_ESC_COPY.statUsage,
    ])

    // —— ③ 源码级反向锁：那两枚"外来"图标（安装的箭头 / 使用量的柱状图）与它们的实现不许回归
    const cardSourceForTagRow = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSourceForTagRow).toContain(
      "import { Bot, Folder, MessageSquare, MoreHorizontal, Pencil, Plus, Star, Trash2, User } from 'lucide-react'",
    )
    expect(cardSourceForTagRow).not.toContain('function BarChartIcon')
    // 作者呈现全文件只有**两处**，且都走同一枚组件（专家卡头 / 技能标签行）
    expect(cardSourceForTagRow.match(/createElement\(AuthorRow/g) ?? []).toHaveLength(2)
    // 技能标签行那三枚统计图标**只能**经 `statIconOf` 拿到（不许再就地 createElement 一枚图标）
    const tagRowSource = cardSourceForTagRow.slice(cardSourceForTagRow.indexOf('const tagRow ='))
    expect(tagRowSource.match(/statIconOf\('(star|user|link)'\)/g) ?? []).toHaveLength(3)
  })

  it('动作位：A 档一律置灰 + 写明原因；召唤 / 立即使用 / 连接 / 断开 四枚文案与原文逐字一致', () => {
    // ★**本刀（workbuddy 风格重构）**：技能卡的右侧动作位**换了形态**——原来那枚「使用 + 启用开关」
    // （容器 `esc-action-box esc-action-box-pinned`、按钮 hover 浮现）已撤下，现在按**是否已安装**分流：
    //   未安装 ⇒ 一枚**常驻圆形「+」**（`.esc-install-plus`）；已安装 ⇒ **「更多」下拉 + 「去试试」**。
    // 专家（召唤）与连接器（连接/断开）两档**一字未改**，仍照原页面的形态。
    // ⇒ 这条用例的判据随之改成「按语义找那一格」，不再按下标硬取——按下标锁渲染树，
    //   改一处版式就得重排一堆断言，而版式本来就是要改的东西。
    const actionBoxOf = (props: Parameters<typeof card>[0], item?: Record<string, unknown>): Element => {
      // 先摘掉 null/undefined/false（React 不渲染的槽位在 createElement 的 children 里就是它们），
      // 再按类名找——顺序会随版式变，**位置**不会。
      // ★**口径 39**：技能卡的动作位搬进了**头行**（图标 | 标题/描述 | 动作 三格），专家/连接器两档
      //   仍在卡片直属层 ⇒ 两处都找。头行本身也按类名认（不按下标硬取）。
      // ★第二参是**这张卡自己的数据**：已连接/未连接的形态不同，必须渲染它自己那张卡，
      //   否则会拿到默认那张（未连接）卡的动作位，断言就成了拿 A 比 A。
      const direct = childrenOf(card(props, item))
      const header = direct.find(node => node !== null && node !== undefined && typeof node === 'object'
        && (node as Element).props['className'] === 'esc-card-header')
      const boxes = [...direct, ...(header === undefined ? [] : childrenOf(asElement(header)))]
        .filter((node): node is Element =>
          node !== null && node !== undefined && node !== false && typeof node === 'object')
      const matches = boxes.filter(node => typeof node.props['className'] === 'string'
        && /esc-action-box|esc-skill-actions/.test(node.props['className']))
      expect(matches).toHaveLength(1)
      return matches[0]!
    }
    // —— 专家：召唤（形态照旧）
    const summonBox = actionBoxOf({ showSummon: true })
    expect(asElement(summonBox).props['className']).toBe('esc-action-box')
    const summon = asElement(childrenOf(summonBox)[0])
    expect(summon.props['children']).toBe('召唤')
    expect(summon.props['disabled']).toBe(true)
    expect(summon.props['className']).toBe('esc-action-solid')
    expect(summon.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // —— 技能·未安装：一枚常驻「+」，无障碍名带技能名；**不画**「去试试」与「更多」
    const plusBox = actionBoxOf({ showUse: true })
    expect(asElement(plusBox).props['className']).toBe('esc-skill-actions')
    const plusRow = asElement(plusBox)
    const plusChildren = childrenOf(plusRow).filter(node => node !== null && node !== undefined && node !== false)
    expect(plusChildren).toHaveLength(1)
    const plus = asElement(plusChildren[0])
    expect(plus.props['className']).toBe('esc-install-plus')
    expect(plus.props['disabled']).toBe(true)
    expect(plus.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    expect(plus.props['aria-label']).toContain(ENTERPRISE_ESC_COPY.installSkill)
    // —— 技能·已安装：「更多」下拉 + 「去试试」两枚并排
    const installedBox = actionBoxOf({ showUse: true, installed: true })
    const installedChildren = childrenOf(asElement(installedBox)).filter(node => node !== null && node !== undefined && node !== false)
    expect(installedChildren).toHaveLength(2)
    // 「去试试」是官方 Button 原语（挂 `esc-action-solid`），同样置灰 + 写明原因
    const tryNow = asElement(installedChildren[1])
    expect(tryNow.props['children']).toBe(ENTERPRISE_ESC_COPY.tryNow)
    expect(tryNow.props['disabled']).toBe(true)
    expect(tryNow.props['className']).toBe('esc-action-solid esc-try-now')
    expect(tryNow.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // 「更多」是官方 `Menu` 原语（自带遮罩/Esc/外部点击），触发钮带无障碍名与 aria-expanded。
    // ★它自己持有 `open` 态（有副作用），纯函数测试渲染不出来 ⇒ 断言落在**导出的那份纯数据**上
    //   （`SKILL_MORE_ENTRIES`），组件本体只用「存在且挂官方 Menu」这一条盖住。
    const moreWrapper = asElement(installedChildren[0])
    expect(typeof moreWrapper.type).toBe('function')
    const cardSourceForMore = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSourceForMore).toContain('items: SKILL_MORE_ENTRIES.map(')
    // 三行逐字（编辑 / 打开文件夹 / 卸载），卸载是**危险档**，其余不带该位
    expect(SKILL_MORE_ENTRIES.map(entry => entry.id)).toEqual(['edit', 'open-folder', 'uninstall'])
    expect(SKILL_MORE_ENTRIES.map(entry => entry.label)).toEqual(['编辑', '打开文件夹', '卸载'])
    expect(SKILL_MORE_ENTRIES[2]!.danger).toBe(true)
    expect(SKILL_MORE_ENTRIES[0]!.danger).toBeUndefined()
    expect(ENTERPRISE_ESC_COPY.useNow).toBe('立即使用')
    // 源码级反向锁：那枚机器人图标（连 import）与"靠 aria-label 承担文案"的写法都不许再回来
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSource).not.toContain('BotMessageSquare')
    expect(cardSource).not.toContain("'aria-label': ENTERPRISE_ESC_COPY.useNow")
    // 「全黑」靠主题 token，不靠内联颜色：**召唤 / 去试试 / 连接 / 断开**四枚恰好 4 处
    // （技能那枚已换成 workbuddy 的「+」与「去试试」，不再有第二个 `esc-action-solid`）
    expect(cardSource.match(/esc-action-solid/g) ?? []).toHaveLength(4)
    // ★口径 36：**失效 token 的源码级反向锁** —— 这三枚在 DSH 主题里根本不存在（真实名见 esc-style.ts
    // 头部的映射表），用了就等于整条声明作废（描边回退 currentColor 变成黑边、底色回退透明）。
    // 卡片源码里一个都不许留（CSS 侧另有同款反向锁）。
    // （判据取 `var(<token>)` 这种**真使用**的写法：注释里为了记录历史可以提到这些名字）
    for (const dead of ['--dsw-alias-accent-primary', '--dsw-alias-background-primary', '--dsw-alias-background-secondary']) {
      expect(cardSource).not.toContain(`var(${dead})`)
    }
    // 首字字母头像的兜底底色必须落在真 token 上（原先是那枚失效的 background-secondary）
    expect(cardSource).toContain("background: 'var(--dsw-alias-bg-skeleton)'")
    // 卡片根类名：技能卡是 workbuddy 那一版（**带标签行**，故另起 `esc-card-skill`）；
    // 专家/连接器沿用原页面的「有/无统计行」两种。
    expect(card({ showSummon: true }).props['className']).toBe('esc-card esc-card-expert')
    // ★SPEC §7：连接器卡属「列表项」那一档 ⇒ 无阴影、走 esc-card-connector
    expect(card({ showConnect: true, showStats: false }).props['className']).toBe('esc-card esc-card-connector')
    // 连接器：未连接只画「连接」；已连接画「断开」+ 开关；标签都是原页面的行内字面量
    const disconnected = card({ showConnect: true })
    const connectBox = actionBoxOf({ showConnect: true })
    const connect = asElement(childrenOf(connectBox)[0])
    expect(connect.props['children']).toBe('连接')
    expect(connect.props['className']).toBe('esc-action-solid')
    expect(disconnected.props['className']).toBe('esc-card esc-card-connector')
    const connectedItem = { connected: true, connectionEnabled: true }
    const connectedCard = card({ showConnect: true }, connectedItem)
    const connectedBox = actionBoxOf({ showConnect: true }, connectedItem)
    expect(asElement(connectedCard).props['className']).toBe('esc-card esc-card-connector')
    expect(asElement(connectedBox).props['className']).toBe('esc-action-box esc-action-box-pinned')
    const breakReveal = asElement(childrenOf(asElement(connectedBox))[0])
    expect(breakReveal.type).toBe('span')
    expect(asElement(childrenOf(breakReveal)[0]).props['className']).toBe('esc-action-solid')
    expect(breakReveal.props['className']).toBe('esc-hover-reveal')
    expect(asElement(childrenOf(breakReveal)[0]).props['children']).toBe('断开')
    expect(asElement(childrenOf(asElement(connectedBox))[1]).props['checked']).toBe(true)
  })

  it('连接器卡片的状态行：分类为空时**不画**状态圆点，但状态文字照画（原文口径）', () => {
    // ★**本刀**：卡片头里那格「发布者行」只在**专家卡**上渲染（技能卡的作者已挪进底部标签行），
    //   连接器的状态行 `.esc-extra-box` 因此从「发布者行里面」**上移到头信息里，与标题平级**。
    //   判据改成**按类名找**那一格，不再按下标数位置——版式本来就是要改的东西。
    const statusRowOf = (item: Record<string, unknown>) => {
      const header = childrenOf(card({ showConnect: true }, item))[0]!
      const headMain = childrenOf(asElement(header))[1]!
      const extraBox = childrenOf(asElement(headMain))
        .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
        .find(node => node.props['className'] === 'esc-extra-box')
      expect(extraBox).toBeTruthy()
      return extraBox as Element
    }
    const withCategory = statusRowOf({ category: '存储与文件' })
    const status = childrenOf(childrenOf(asElement(withCategory))[0]!)[1]!
    expect(asElement(status).props['children']).toEqual([expect.anything(), '未连接'])
    expect(asElement(childrenOf(asElement(status))[0]).props['className']).toBe('esc-status-dot')
    const withoutCategory = statusRowOf({})
    const status2 = childrenOf(childrenOf(asElement(withoutCategory))[0]!)[1]!
    // 分类为空 ⇒ 圆点那格是 null（React 不渲染），状态文字照画
    expect(childrenOf(asElement(status2))).toEqual([null, '未连接'])
  })

  it('工具栏：主 tab 的组成随资源类型变（已连接的仅连接器、我启用的仅技能），顺序照原文件', () => {
    const labelsOf = (resourceType: 'expert' | 'skill' | 'connector') => {
      const toolbar = asElement(
        EnterpriseEscToolbar({
          resourceType,
          source: 'system',
          onSourceChange: () => undefined,
          categories: [],
          activeCategory: '',
          onCategoryChange: () => undefined,
          keyword: '',
          onKeywordChange: () => undefined,
        } as never),
      )
      // ★维度标签已**移出第一栏**（用户裁决：精选在第2栏、维度另起一行）⇒ 判据改成
      //   在整棵工具栏树里**按类名找**那一格，不再按「主行的第几格」取。
      const walk = (node: unknown, out: Element[] = []): Element[] => {
        if (Array.isArray(node)) {
          for (const each of node) walk(each, out)
          return out
        }
        if (node === null || node === undefined || node === false) return out
        if (typeof node !== 'object') return out
        const element = node as Element
        if (element.props['className'] === 'esc-source-tabs') {
          out.push(element)
          return out
        }
        return walk(element.props['children'], out)
      }
      const sourceTabs = walk(toolbar)[0]
      expect(sourceTabs).toBeTruthy()
      return childrenOf(sourceTabs as Element).map(node => asElement(node).props['children'])
    }
    expect(labelsOf('expert')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间', '我启用的'])
    expect(labelsOf('connector')).toEqual(['系统广场', '团队空间', '已连接的'])
  })

  it('工具栏：「更多」只系统广场维度点亮、连接器页整格不画；搜索用原占位符；分类行按分类数组画', () => {
    const toolbarOf = (props: Record<string, unknown>) =>
      asElement(
        EnterpriseEscToolbar({
          resourceType: 'expert',
          source: 'system',
          onSourceChange: () => undefined,
          categories: [],
          activeCategory: '',
          onCategoryChange: () => undefined,
          keyword: '',
          onKeywordChange: () => undefined,
          ...props,
        } as never),
      )
    // ★右块在**第一栏**（`.esc-toolbar-row`）里，按类名找（行序改过，别按下标取）
    const rightOf = (element: Element) => {
      const row = childrenOf(element)
        .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
        .find(node => node.props['className'] === 'esc-toolbar-row')
      expect(row).toBeTruthy()
      const found = childrenOf(row as Element)
        .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
        .find(node => node.props['className'] === 'esc-toolbar-right')
      expect(found).toBeTruthy()
      return found as Element
    }
    // 「更多」= **真超链接**（用户裁决指向 https://skillhub.cn/）：只有系统广场维度可见/可点，
    // 其余两维保留占位（visibility 隐藏 + 不吃点击），连接器页整格不画 —— 与官方口径一致。
    const moreLink = asElement(childrenOf(rightOf(toolbarOf({ source: 'system' })))[0])
    expect(moreLink.type).toBe('a')
    expect(moreLink.props['className']).toBe('esc-more')
    expect(moreLink.props['href']).toBe('https://skillhub.cn/')
    expect(moreLink.props['target']).toBe('_blank')
    expect(moreLink.props['rel']).toBe('noreferrer noopener')
    expect(moreLink.props['children']).toBe(ENTERPRISE_ESC_COPY.more)
    expect(moreLink.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.moreExternal)
    expect(asElement(childrenOf(rightOf(toolbarOf({ source: 'team' })))[0]).props['className']).toBe('esc-more esc-more-hidden')
    expect(ESC_RESOURCE_MORE_HREF).toBe('https://skillhub.cn/')
    expect(childrenOf(rightOf(toolbarOf({ showMore: false })))[0]).toBeNull()
    const search = asElement(childrenOf(rightOf(toolbarOf({})))[1])
    expect(search.props['placeholder']).toBe(ENTERPRISE_ESC_COPY.searchPlaceholder)
    // 分类行：首位「全部」+ 各项，active 跟着 activeCategory
    const withCategories = toolbarOf({
      categories: [
        { key: '', label: '全部' },
        { key: '存储与文件', label: '存储与文件' },
      ],
      activeCategory: '存储与文件',
    })
    // 二级分类行在第一栏**之后**（两栏结构），按类名找
    const categoryRow = withCategories.props.children
      .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
      .find(node => node.props['className'] === 'esc-category-tabs')!
    expect(childrenOf(asElement(categoryRow)).map(node => asElement(node).props['active'])).toEqual([false, true])
    // 分类读不到时给一句人话（本页新增；原页面静默）：分类数组为空 ⇒ 分类行整格是 null，提示在第三格
    // ★两栏结构后提示行的下标变了 ⇒ 按类名找（别按下标）
    const unavailable = toolbarOf({ categoriesUnavailable: true }).props.children
      .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
      .find(node => node.props['className'] === 'esc-toolbar-note')!
    expect(asElement(unavailable).props['className']).toBe('esc-toolbar-note')
    expect(asElement(unavailable).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable)
  })
})

describe('esc：失败面收口（本刀 —— 精选行与列表页同一套判据）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  /** 整棵树的可见文本（`null`/布尔槽位按 React 的规则不渲染）。 */
  const textOf = (node: unknown): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    return childrenOf(asElement(node)).map(textOf).join('')
  }

  it('★精选行失败态：人话与下一步取自唯一码表、稳定码上屏、**平台原话一个字都不上屏**、终态不画「重试」', () => {
    const body = asElement(
      enterpriseEscFeaturedBody({ kind: 'failed', code: ESC_MISSING_ENDPOINT_CODES.recommend }, () => undefined),
    )
    expect(body.props['className']).toBe('esc-featured-note')
    expect(body.props['role']).toBe('alert')
    const kids = childrenOf(body)
    // ① 人话（唯一码表那句）② 下一步 ③ 稳定码 ④ 终态 ⇒ 第 4 格是 null，**不画**「重试」
    expect(asElement(kids[0]).props['children']).toBe(enterpriseErrorMessage('ENT_ESC_RECOMMEND_UNAVAILABLE'))
    expect(asElement(kids[1]).props['className']).toBe('esc-sub')
    expect(asElement(kids[1]).props['children']).toBe(enterpriseErrorAction('ENT_ESC_RECOMMEND_UNAVAILABLE'))
    expect(asElement(kids[2]).props['className']).toBe('esc-state-code')
    expect(asElement(kids[2]).props['children']).toBe('ENT_ESC_RECOMMEND_UNAVAILABLE')
    expect(kids[3]).toBeNull()
    expect(enterpriseErrorRetryable('ENT_ESC_RECOMMEND_UNAVAILABLE')).toBe(false)
    // 平台那句自由文本（`No static resource …`）在这棵树里**没有位置**：状态里只有码
    expect(textOf(body)).not.toContain('No static resource')
    // ★源码级反向锁：这条行不再把平台 `message` 拼上屏、也不再自留一句「加载失败」前缀
    const source = readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('envelope.message')
    expect(source).not.toContain('loadFailed')
    expect('loadFailed' in ENTERPRISE_ESC_LOCAL_COPY).toBe(false)
  })

  it('★可重试的码才画「重试」：那枚按钮的回调就是重发（与「换一批」同一条路）', () => {
    const retry = vi.fn()
    const body = asElement(enterpriseEscFeaturedBody({ kind: 'failed', code: 'ENT_NUWAX_UNAVAILABLE' }, retry))
    expect(enterpriseErrorRetryable('ENT_NUWAX_UNAVAILABLE')).toBe(true)
    const button = asElement(childrenOf(body)[3])
    expect(button.type).toBe('button')
    expect(button.props['className']).toBe('esc-retry')
    expect(button.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.retry)
    ;(button.props['onClick'] as () => void)()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('★平台 `4040` 按**面**归一：三面各说各的事实，其余码原样透传', () => {
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.connector)).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.directory)).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('ENT_ESC_RECOMMEND_UNAVAILABLE')
    // 其余码一个字都不改（含非 4040 的数字码、字符串码与空值）
    expect(escPlatformErrorCode('4030', ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('4030')
    expect(escPlatformErrorCode(4041, ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('4041')
    expect(escPlatformErrorCode(undefined, ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('')
    // 取异常里的码：本机路由那枚原样取出、取不到回本机兜底码（不再借页内某句前缀顶替）
    expect(escErrorCodeOf({ code: 'ENT_AUTH_REQUIRED' })).toBe('ENT_AUTH_REQUIRED')
    expect(escErrorCodeOf(new Error('boom'))).toBe('ENT_LOCAL_RESPONSE_INVALID')
    expect(escErrorCodeOf({ code: '' })).toBe('ENT_LOCAL_RESPONSE_INVALID')
    // 四枚都在**唯一码表**里、都不可重试、四句话两两不同
    //（同一件事不许说两种话；四件不同的事也不许说成同一句）
    const messages = (['connector', 'directory', 'enabled', 'recommend'] as const).map(key => {
      const code = ESC_MISSING_ENDPOINT_CODES[key]
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      expect(enterpriseErrorRetryable(code), code).toBe(false)
      return enterpriseErrorMessage(code)
    })
    expect(new Set(messages).size).toBe(4)
  })

  it('★列表面的 `4040` 按「资源类型 + 维度」取码：专家/技能不再被说成「没有连接器目录」', () => {
    expect(missingEndpointCodeOf('connector', 'system')).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    expect(missingEndpointCodeOf('expert', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('skill', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('skill', 'team')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    // 这两句话措辞**必须不同**——本刀修的正是"专家/技能面上报连接器"那句假话
    expect(enterpriseErrorMessage(missingEndpointCodeOf('expert', 'system')))
      .not.toBe(enterpriseErrorMessage(missingEndpointCodeOf('connector', 'system')))
  })

  it('★「我启用的」是另一个端点：技能目录缺端点 ≠ 技能启停清单缺端点（本刀，有现场探针作证）', () => {
    // 现场：同一刻 skill/list → 0000 / total 138，skill/enable/list → 4040
    expect(missingEndpointCodeOf('skill', 'enabled')).toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    // 两句话必须不同：说"没有技能目录"是假话（目录在），缺的是启停清单
    expect(enterpriseErrorMessage(missingEndpointCodeOf('skill', 'enabled')))
      .not.toBe(enterpriseErrorMessage(missingEndpointCodeOf('skill', 'system')))
    // 反向锁：目录面**不许**落到启停清单那一枚（反向也一样），且连接器面与维度无关
    expect(missingEndpointCodeOf('skill', 'system')).not.toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    expect(missingEndpointCodeOf('expert', 'enabled')).not.toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    expect(missingEndpointCodeOf('connector', 'enabled')).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    // 源码级锁：两个失败落点都必须把**维度**传进去，否则又会退回"按资源类型"那句话
    const source = readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8')
    expect(source).toContain('missingEndpointCodeOf(resourceType, source)')
    expect(source).not.toContain('missingEndpointCodeOf(resourceType)')
  })

  it('★本刀只动失败那一态：加载 / 空 / 未登录三态的标记与文案一字未改', () => {
    expect(textOf(enterpriseEscFeaturedBody({ kind: 'loading' }, () => undefined))).toBe(ENTERPRISE_ESC_COPY.loading)
    expect(textOf(enterpriseEscFeaturedBody({ kind: 'empty' }, () => undefined))).toBe(ENTERPRISE_ESC_COPY.emptyData)
    const signedOut = asElement(enterpriseEscFeaturedBody({ kind: 'unauthenticated' }, () => undefined))
    expect(signedOut.props['className']).toBe('esc-featured-note')
    expect(textOf(signedOut)).toContain(ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle)
    expect(textOf(signedOut)).toContain(ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody)
  })

  it('★本刀（用户裁决「精选最多显示六个」）：只画 6 枚，状态里仍如实留着平台给的那一批', () => {
    // 本机实测 /api/display/recommend/list ⇒ 0000 / total 19 ⇒ 上限是**展示**规则，不是取数规则：
    // 平台给多少照旧原样进状态（`items` 就是入参那一批），只有这一行截前六枚。
    const records: readonly EscRecommendRecord[] = Array.from({ length: 19 }, (_unused, index) => ({
      id: 1000 + index,
      targetType: 'Skill',
      targetId: index,
      recType: 'recommend',
      label: `推荐${index}`,
    }))
    const grid = asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: records }, () => undefined))
    expect(grid.props['className']).toBe('esc-featured-grid')
    expect(ENTERPRISE_ESC_FEATURED_MAX).toBe(6)
    expect(grid.props['children'] as readonly unknown[]).toHaveLength(6)
    // 恰好六条 ⇒ 一枚不少；不足六条 ⇒ 照原样画（上限只截多，不许把不足的也裁掉或补齐）
    expect(
      (asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: records.slice(0, 6) }, () => undefined))
        .props['children'] as readonly unknown[]),
    ).toHaveLength(6)
    expect(
      (asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: records.slice(0, 5) }, () => undefined))
        .props['children'] as readonly unknown[]),
    ).toHaveLength(5)
  })
})
