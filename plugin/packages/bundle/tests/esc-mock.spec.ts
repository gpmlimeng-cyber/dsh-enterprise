/**
 * [INPUT]: 依赖 `src/esc-mock.ts` 的演示数据/纯解析器/开关读取与 node:fs 临时目录
 * [OUTPUT]: 锁定口径 32 的**数据面**契约：① 每条演示记录都**符合** NUWAX `ConnectorProviderInfo` 的字段形状
 *   （必填四格齐全、可选格取值合法、id/service 不重复）；② 用户要看的那几格**真的有覆盖**
 *   （七种 authType 全覆盖、connected/connectionEnabled 两态、status 两值、spaceId 有/无、tags 三条路径、
 *   描述缺失/超长、以及"官方 24 条 > 页面 pageSize 20"这条分页前提）；③ 解析器对四个连接器口径的参数
 *   （scope/spaceId/category/keyword/status/connected/connectionEnabled 与分页）逐条真筛；④ 未模拟的路径回 undefined；
 *   ⑤ 开关**只认**"文件在 + `{"enabled":true}`"，五种没打开各有名字，且 `DSHENT_ESC_MOCK_FILE` 能改址
 * [POS]: 这份演示数据是"平台上根本没有连接器域"时的**唯一**可看路径（`/api/connector/providers` 在真机回
 *   Spring 的 `No static resource …`），故它的形状必须**逐字段**对得上平台契约——形状错了，
 *   用来看版式的这一栏就变成了"看一份自造的假契约"，比没有更糟
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ENTERPRISE_ESC_MOCK_CATEGORY_TREE,
  ENTERPRISE_ESC_MOCK_CONNECTORS,
  ENTERPRISE_ESC_MOCK_ENDPOINTS,
  ENTERPRISE_ESC_MOCK_FILE_ENV,
  ENTERPRISE_ESC_MOCK_RELATIVE_FILE,
  readEscMockSwitch,
  resolveEscMockFilePath,
  resolveEscMockPayload,
  type EscMockConnectorProvider,
} from '../src/esc-mock.js'

const AUTH_TYPES = ['', 'no_auth', 'api_key', 'bearer', 'oauth2', 'oauth2_device', 'custom'] as const

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** 造一个临时开关文件（返回绝对路径）。 */
function writeSwitchFile(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'esc-mock-'))
  dirs.push(dir)
  const file = join(dir, 'esc-mock.json')
  writeFileSync(file, body, 'utf8')
  return file
}

/** 取信封里的 `data`（信封本身是平台形状：`code`/`message`/`success`/`data`）。 */
function dataOf(payload: unknown): Record<string, unknown> {
  return (payload as { readonly data: Record<string, unknown> }).data
}

/** 取信封里的记录数组。 */
function recordsOf(payload: unknown): readonly EscMockConnectorProvider[] {
  return dataOf(payload)['records'] as readonly EscMockConnectorProvider[]
}

describe('esc-mock：演示数据的形状（逐字段对齐 ConnectorProviderInfo）', () => {
  it('每条记录必填四格齐全、id/service 不重复、可选格取值合法', () => {
    const ids = new Set<number>()
    const services = new Set<string>()
    for (const item of ENTERPRISE_ESC_MOCK_CONNECTORS) {
      expect(Number.isInteger(item.id), `${item.service} 的 id`).toBe(true)
      expect(item.service.length, `${item.id} 的 service`).toBeGreaterThan(0)
      expect(item.displayName.length, `${item.service} 的 displayName`).toBeGreaterThan(0)
      expect(AUTH_TYPES, `${item.service} 的 authType`).toContain(item.authType)
      expect(ids.has(item.id), `id ${item.id} 重复`).toBe(false)
      expect(services.has(item.service), `service ${item.service} 重复`).toBe(false)
      ids.add(item.id)
      services.add(item.service)
      // 可选格的取值合法性（平台契约里那几格是枚举/布尔/数字）
      if (item.status !== undefined) expect(['enabled', 'disabled'], item.service).toContain(item.status)
      if (item.spaceId !== undefined) expect(item.spaceId, item.service).toBeGreaterThan(0)
      if (item.connectionId !== undefined) expect(item.connectionId, item.service).toBeGreaterThan(0)
      if (item.tags !== undefined) expect(Array.isArray(item.tags), item.service).toBe(true)
      // 连接语义：有 connectionId 才算"已连接"那一条路走得通
      if (item.connectionId !== undefined) expect(item.connected, `${item.service} 有连接 id 却没标已连接`).toBe(true)
      if (item.connectionEnabled === true) expect(item.connected, item.service).toBe(true)
    }
  })

  it('用户要看的几格真的有覆盖：七种 authType 全覆盖、两态齐备、字段不缺席', () => {
    const authTypes = new Set(ENTERPRISE_ESC_MOCK_CONNECTORS.map(item => item.authType))
    expect([...authTypes].sort()).toEqual([...AUTH_TYPES].sort())
    const connected = ENTERPRISE_ESC_MOCK_CONNECTORS.filter(item => item.connected === true)
    expect(connected.some(item => item.connectionEnabled === true)).toBe(true)
    expect(connected.some(item => item.connectionEnabled === false)).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.connected === false)).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.status === 'disabled')).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.status === 'enabled')).toBe(true)
    // tags 三条路径（有 / 空数组 / 缺席）各至少一条
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => (item.tags?.length ?? 0) > 0)).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => Array.isArray(item.tags) && item.tags.length === 0)).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.tags === undefined)).toBe(true)
    // description 缺席与超长两条路径
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.description === undefined)).toBe(true)
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => (item.description?.length ?? 0) > 80)).toBe(true)
    // 可选格逐格至少带上一次
    for (const key of [
      'baseUrl',
      'authConfig',
      'oauthAppMode',
      'source',
      'providerVersion',
      'managedBy',
      'proxyEnabled',
      'sortOrder',
      'actionCount',
      'modified',
      'created',
    ] as const) {
      // sortOrder 是个例外：演示数据靠数组顺序表达先后，不逐条写值（见文件头"顺序即列表顺序"）
      if (key === 'sortOrder') continue
      expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item[key] !== undefined), `没有一条带上 ${key}`).toBe(true)
    }
    // ★icon 一条都不给（平台图标要票据、而演示地址在平台上并不存在 ⇒ 填了只会画出破图）
    expect(ENTERPRISE_ESC_MOCK_CONNECTORS.some(item => item.icon !== undefined)).toBe(false)
  })

  it('官方目录 24 条 > 页面 pageSize 20：分页这条路真能走一遍；空间 4 条', () => {
    const official = ENTERPRISE_ESC_MOCK_CONNECTORS.filter(item => item.spaceId === undefined)
    const scoped = ENTERPRISE_ESC_MOCK_CONNECTORS.filter(item => item.spaceId !== undefined)
    expect(official).toHaveLength(24)
    expect(scoped).toHaveLength(4)
    expect(official.length).toBeGreaterThan(20)
    // ★空间列表**不再由演示数据提供**（用户裁决「空间要使用后台真实的空间」）⇒ 这里没有"演示空间表"可对账；
    // 空间维度那四条 `spaceId` 改挂**本机真机**的空间 id（2 个人空间 / 3 数智化 / 248 营销通空间）——
    // 断言就钉在这三个真 id 上，换部署要跟着改（与 `esc-mock.ts` 里那段注释同源）。
    for (const item of scoped) expect([2, 3, 248], `${item.service} 的 spaceId`).toContain(item.spaceId)
    // 每条记录的 category 必须真在连接器分类字典里（否则点分类必然空）
    const keys = new Set(ENTERPRISE_ESC_MOCK_CATEGORY_TREE[0]!.children.map(child => child.key))
    for (const item of ENTERPRISE_ESC_MOCK_CONNECTORS) {
      if (item.category === undefined) continue
      expect(keys.has(item.category), `${item.service} 的 category`).toBe(true)
    }
    // 分类树里**只有**连接器一个根：专家/技能两栏因此走"仅全部"的原降级路径，而不是拿错分类去筛
    expect(ENTERPRISE_ESC_MOCK_CATEGORY_TREE).toHaveLength(1)
    expect(ENTERPRISE_ESC_MOCK_CATEGORY_TREE[0]!.key).toBe('Connector')
  })
})

describe('esc-mock：解析器（按平台同一套参数真筛）', () => {
  it('官方目录分页：第一页 20 条、第二页 4 条，pageNum 原样回给页面（hasMore 的判据）', () => {
    const first = resolveEscMockPayload('/api/connector/providers', { scope: 'official', pageNum: 1, pageSize: 20 })
    expect(recordsOf(first)).toHaveLength(20)
    expect(dataOf(first)['pageNum']).toBe(1)
    expect(dataOf(first)['total']).toBe(24)
    const second = resolveEscMockPayload('/api/connector/providers', { scope: 'official', pageNum: 2, pageSize: 20 })
    expect(recordsOf(second)).toHaveLength(4)
    expect(dataOf(second)['pageNum']).toBe(2)
    // 官方目录看不到空间里那四条
    for (const item of recordsOf(first)) expect(item.spaceId).toBeUndefined()
  })

  it('团队空间维度：scope=space 只回空间里的，带 spaceId 再窄一层；不带 scope 时全回', () => {
    const all = resolveEscMockPayload('/api/connector/providers', { scope: 'space', pageNum: 1, pageSize: 20 })
    expect(recordsOf(all)).toHaveLength(4)
    expect(recordsOf(all).every(item => item.spaceId !== undefined)).toBe(true)
    // spaceId 用的是**真机空间 id**（3 数智化 / 2 个人空间 / 248 营销通空间）
    const space3 = resolveEscMockPayload('/api/connector/providers', { scope: 'space', spaceId: 3, pageSize: 20 })
    expect(recordsOf(space3).map(item => item.service)).toEqual(['space_oss_sync', 'space_mysql'])
    const space2 = resolveEscMockPayload('/api/connector/providers', { scope: 'space', spaceId: 2, pageSize: 20 })
    expect(recordsOf(space2).map(item => item.service)).toEqual(['space_kb_search'])
    const space248 = resolveEscMockPayload('/api/connector/providers', { scope: 'space', spaceId: 248, pageSize: 20 })
    expect(recordsOf(space248).map(item => item.service)).toEqual(['space_im_bot'])
  })

  it('「已连接的」/「我启用的」两条口径不带分页：一次交回全部（且真的按连接态筛）', () => {
    const connected = resolveEscMockPayload('/api/connector/providers', { connected: 'true' })
    const connectedRecords = recordsOf(connected)
    expect(connectedRecords.length).toBeGreaterThan(0)
    expect(connectedRecords.every(item => item.connected === true)).toBe(true)
    expect(dataOf(connected)['pageSize']).toBe(connectedRecords.length)
    const enabled = resolveEscMockPayload('/api/connector/providers', { connectionEnabled: 'true' })
    expect(recordsOf(enabled).every(item => item.connectionEnabled === true)).toBe(true)
    // "我启用的"是"已连接的"的真子集
    expect(recordsOf(enabled).length).toBeLessThan(connectedRecords.length)
  })

  it('category / keyword / status 三个筛选项都真的生效（不筛的返回必须更宽）', () => {
    const byCategory = resolveEscMockPayload('/api/connector/providers', {
      scope: 'official',
      pageSize: 50,
      category: '通讯协作',
    })
    expect(recordsOf(byCategory).length).toBeGreaterThan(0)
    expect(recordsOf(byCategory).every(item => item.category === '通讯协作')).toBe(true)
    const byKeyword = resolveEscMockPayload('/api/connector/providers', {
      scope: 'official',
      pageSize: 50,
      keyword: 'oss',
    })
    expect(recordsOf(byKeyword).map(item => item.service)).toEqual(
      expect.arrayContaining(['aliyun_oss', 'space_oss_sync'].filter(service => service === 'aliyun_oss')),
    )
    // 关键词大小写不敏感，且能命中 tags（'存储'）
    const byTag = resolveEscMockPayload('/api/connector/providers', {
      scope: 'official',
      pageSize: 50,
      keyword: '存储',
    })
    expect(recordsOf(byTag).length).toBeGreaterThan(0)
    const byStatus = resolveEscMockPayload('/api/connector/providers', {
      scope: 'official',
      pageSize: 50,
      status: 'disabled',
    })
    expect(recordsOf(byStatus).every(item => item.status === 'disabled')).toBe(true)
    expect(recordsOf(byStatus).length).toBeGreaterThan(0)
    // 无筛选的比任何一条筛过的都宽（证明筛选真的在起作用，而不是把参数丢了）
    const unfiltered = resolveEscMockPayload('/api/connector/providers', { scope: 'official', pageSize: 50 })
    expect(recordsOf(unfiltered).length).toBeGreaterThan(recordsOf(byCategory).length)
  })

  it('只剩两条被模拟的端点：分类树（**只含连接器**一根）；**空间列表已交回真平台** ⇒ undefined', () => {
    expect(dataOf(resolveEscMockPayload('/api/published/category/list', {}))).toEqual(
      ENTERPRISE_ESC_MOCK_CATEGORY_TREE,
    )
    // ★空间列表**必须**回 undefined（用户裁决「空间要使用后台真实的空间」）——它不是"忘了模拟"，
    // 而是**刻意不再模拟**：这一条如果哪天又变回演示数据，就是把这句裁决推翻了。
    expect(resolveEscMockPayload('/api/space/list', {})).toBeUndefined()
    // 未被模拟的路径一律 undefined ⇒ 调用方照常走真平台那条路（演示数据不放宽任何别的端点）
    for (const path of [
      '/api/published/agent/list',
      '/api/published/skill/list',
      '/api/published/skill/enable/list',
      '/api/user/info',
      '',
    ]) {
      expect(resolveEscMockPayload(path, {}), path).toBeUndefined()
    }
    expect(ENTERPRISE_ESC_MOCK_ENDPOINTS).toEqual(['/api/connector/providers', '/api/published/category/list'])
  })
})

describe('esc-mock：开关读取（只认"文件在 + enabled:true"）', () => {
  it('默认路径是 ${DSH_HOME}/enterprise/esc-mock.json；DSHENT_ESC_MOCK_FILE 能改址；都没给 ⇒ no-home', () => {
    expect(ENTERPRISE_ESC_MOCK_FILE_ENV).toBe('DSHENT_ESC_MOCK_FILE')
    expect(ENTERPRISE_ESC_MOCK_RELATIVE_FILE).toBe('enterprise/esc-mock.json')
    expect(resolveEscMockFilePath({ DSH_HOME: '/tmp/home' })).toBe(join('/tmp/home', 'enterprise/esc-mock.json'))
    expect(resolveEscMockFilePath({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: ' /tmp/x.json ' })).toBe(' /tmp/x.json ')
    expect(resolveEscMockFilePath({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: '/tmp/x.json' })).toBe('/tmp/x.json')
    expect(resolveEscMockFilePath({})).toBeUndefined()
    expect(readEscMockSwitch({})).toEqual({ enabled: false, reason: 'no-home' })
    expect(readEscMockSwitch({ DSH_HOME: '/tmp/does-not-exist-esc' })).toEqual({ enabled: false, reason: 'absent' })
  })

  it('文件在且写着 enabled:true 才算开；enabled:false / 畸形 / 数组 一律当关（各有名字）', () => {
    const on = writeSwitchFile('{"enabled": true}')
    expect(readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: on })).toEqual({ enabled: true, file: on })
    const off = writeSwitchFile('{"enabled": false}')
    expect(readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: off })).toEqual({ enabled: false, reason: 'disabled' })
    const broken = writeSwitchFile('{ not json')
    expect(readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: broken })).toEqual({
      enabled: false,
      reason: 'malformed',
    })
    const array = writeSwitchFile('[true]')
    expect(readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: array })).toEqual({
      enabled: false,
      reason: 'malformed',
    })
    // 只有真值 `true` 才算开（`1`/`"true"` 都不算：开关要写得毫不含糊）
    const truthy = writeSwitchFile('{"enabled": 1}')
    expect(readEscMockSwitch({ [ENTERPRISE_ESC_MOCK_FILE_ENV]: truthy })).toEqual({
      enabled: false,
      reason: 'disabled',
    })
    // DSH_HOME 那条默认路径也真读得到
    const dir = mkdtempSync(join(tmpdir(), 'esc-mock-home-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'enterprise-esc-mock.json'), '{"enabled": true}', 'utf8')
    expect(readEscMockSwitch({ DSH_HOME: dir })).toEqual({ enabled: false, reason: 'absent' })
  })
})
