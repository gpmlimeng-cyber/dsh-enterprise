/**
 * [INPUT]: 依赖 dsh-ui 同源 local-api、标准 Response 与 EventSource test double
 * [OUTPUT]: 验证账号/插件/技能严格解码、地址/卸载固定路径、脱敏投影、显式刷新与秘密字段拒绝，**已装技能正文取数**（同源 `/skills/content` + 两个标识符查询参数按 `encodeURIComponent` 编码、键集封闭拒绝宿主路径与超限正文），以及**本刀新增的详情子页面两条取数**——本机**文件树** `/skills/<id>/files` 与**树里单个文本文件** `/skills/<id>/file?path=`（相对路径只进查询串且一律 `encodeURIComponent`、Host 多塞宿主绝对路径或树内重复路径即 `ENT_LOCAL_RESPONSE_INVALID`） **本刀（企业插件真取消）新增**：`cancelPlugin` 的方法 / 路径 / body 逐字断言（`POST /enterprise/api/v1/local/plugins/cancel`、正文关闭键集恰好 `{packageName}`、路径常量与 Host 注册面同值），以及「响应仍是同一个严格解码器（多一个字段即畸形）」
 * [POS]: dsh-ui 浏览器网络边界测试，确保浏览器只能消费 Host 脱敏 DTO
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createEnterpriseLocalApi,
  decodeEnterpriseCredentialResult,
  decodeEnterpriseLoginForm,
  decodeEnterprisePluginStatus,
  decodeEnterpriseLocalStatus,
  ENTERPRISE_CONNECTION_STATES,
  ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH,
  MANAGED_PLUGIN_STATES,
} from '../src/local-api.js'

const STATUS = {
  state: 'SIGNED_OUT' as const,
  bundleVersion: '0.1.0',
  platformUrl: 'https://enterprise.example.com',
  transport: 'webServer.register' as const,
}

const PLUGIN = {
  packageName: '@example/dsh-code-review',
  version: '1.2.0',
  sha256: 'a'.repeat(64),
  desiredRevision: 7,
  desiredState: 'INSTALLED' as const,
  state: 'RESTART_REQUIRED' as const,
  lastErrorCode: null,
  restartMarker: 'run-20260819',
}

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}

describe('enterprise local browser API', () => {
  it('strictly decodes every public connection state', () => {
    for (const state of ENTERPRISE_CONNECTION_STATES) {
      const value = state === 'UNCONFIGURED'
        ? { ...STATUS, state, platformUrl: null }
        : { ...STATUS, state }
      expect(decodeEnterpriseLocalStatus(value)).toEqual(value)
    }
    expect(() => decodeEnterpriseLocalStatus({ ...STATUS, accessToken: 'must-not-cross' }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterpriseLocalStatus({ ...STATUS, platformUrl: 'https://user:secret@example.com' }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  // 宿主交浏览器半打开时下发的授权 URL：必须带 PKCE 查询串，但不许带凭据或片段。
  it('carries the client-handoff authorize URL and refuses malformed ones', () => {
    const authorizeUrl = 'https://enterprise.example.com/enterprise/auth/v1/authorize?state=s&code_challenge=c'
    expect(decodeEnterpriseLocalStatus({ ...STATUS, authorizeUrl })).toEqual({ ...STATUS, authorizeUrl })
    // 只带 OPTIONAL：host 交接（宿主自己打开）时这个字段根本不出现。
    expect(decodeEnterpriseLocalStatus({ ...STATUS })).toEqual(STATUS)
    const malformed: readonly (readonly [string, unknown])[] = [
      ['empty', ''],
      ['not a url', 'not-a-url'],
      ['non http', 'ftp://enterprise.example.com/authorize'],
      ['credentials', 'https://user:secret@enterprise.example.com/authorize'],
      ['fragment', `${authorizeUrl}#frag`],
      ['non string', 42],
    ]
    for (const [label, bad] of malformed) {
      expect(() => decodeEnterpriseLocalStatus({ ...STATUS, authorizeUrl: bad }), label)
        .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('projects account bootstrap and never returns unrelated policy fields', async () => {
    const fetcher = vi.fn(async () => ok({
      revision: 7,
      user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
      device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
      models: [{ alias: 'not-exposed-by-t07' }],
      quotas: [],
      plugins: { revision: 1, assignments: [] },
      sessionPolicy: { enabled: true },
    }))
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.bootstrap(new AbortController().signal)).resolves.toEqual({
      user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
      device: { id: '90018', installationId: '4c96d076-a80a-4b6c-8df6-f0db804b6f0a', status: 'ACTIVE' },
      sessionPolicyEnabled: true,
    })
  })

  it('strictly validates plugin records and drops SHA and restart markers from the browser projection', async () => {
    for (const state of MANAGED_PLUGIN_STATES) {
      expect(decodeEnterprisePluginStatus({ assignmentRevision: 7, plugins: [{ ...PLUGIN, state }] }))
        .toEqual({
          assignmentRevision: 7,
          plugins: [{
            packageName: PLUGIN.packageName,
            version: PLUGIN.version,
            desiredRevision: 7,
            desiredState: 'INSTALLED',
            state,
            lastErrorCode: null,
          }],
        })
    }
    expect(() => decodeEnterprisePluginStatus({
      assignmentRevision: 7,
      plugins: [{ ...PLUGIN, tgzPath: '/private/plugin.tgz' }],
    })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePluginStatus({
      assignmentRevision: 7,
      plugins: [{ ...PLUGIN, accessToken: 'must-not-cross' }],
    })).toThrow('ENT_LOCAL_RESPONSE_INVALID')

    const fetcher = vi.fn(async () => ok({
      assignmentRevision: 7,
      plugins: [PLUGIN],
      lastReportErrorCode: 'ENT_PLATFORM_UNAVAILABLE',
    }))
    const projected = await createEnterpriseLocalApi(fetcher).plugins(new AbortController().signal)
    expect(projected).toMatchObject({ assignmentRevision: 7, lastReportErrorCode: 'ENT_PLATFORM_UNAVAILABLE' })
    expect(JSON.stringify(projected)).not.toMatch(/sha256|restartMarker|tgz|token|publicKey|cli/i)
    expect(fetcher).toHaveBeenCalledWith(
      '/enterprise/api/v1/local/plugins',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })

  it('keeps catalog metadata separate from installation facts and sends explicit version-bound commands', async () => {
    const item = { pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100, operatingSystems: ['darwin'] }
    const status = { assignmentRevision: 7, catalog: [item], plugins: [] }
    expect(decodeEnterprisePluginStatus(status)).toEqual(status)
    for (const catalog of [[{ ...item, accessToken: 'secret' }], [{ ...item, downloadUrl: 'https://invalid' }], [item, item], [{ ...item, sizeBytes: -1 }]]) {
      expect(() => decodeEnterprisePluginStatus({ ...status, catalog })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    const fetcher = vi.fn(async () => ok(status))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await api.installPlugin(item.packageName, item.pluginVersionId, signal)
    expect(fetcher).toHaveBeenLastCalledWith('/enterprise/api/v1/local/plugins/install', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ packageName: item.packageName, pluginVersionId: '880' }), signal,
    }))
    await api.removePlugin(item.packageName, signal)
    expect(fetcher).toHaveBeenLastCalledWith('/enterprise/api/v1/local/plugins/remove', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ packageName: item.packageName }), signal,
    }))
  })

  // 本刀（卡片第二行改描述）：catalog 里新增的**可选** `description` 照技能侧可选 `category` 的同一口径归一——
  // 缺席 / null / 空串一律「没有这个键」（卡片据此说「暂无描述」），非 string 非 null 或超过契约上限判畸形。
  it('normalizes the optional catalog description exactly like the optional skill category', () => {
    const base = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = { assignmentRevision: 7, plugins: [] }
    // 有描述：收下并保留原值（不改写、不 trim、不截断）。
    const described = decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, description: '把代码审查规则带进新会话。' }] })
    expect(described.catalog?.[0]?.description).toBe('把代码审查规则带进新会话。')
    // 三种「没有描述」的形态都归一成**没有这个键**（不是空串、不是 null）。
    for (const description of [undefined, null, '']) {
      const decoded = decodeEnterprisePluginStatus({
        ...status,
        catalog: [{ ...base, ...(description === undefined ? {} : { description }) }],
      })
      expect(decoded.catalog?.[0], String(description)).not.toHaveProperty('description')
    }
    // 形状不对（非 string 非 null）与超过契约上限（1000）一律判畸形，绝不静默截断或猜。
    for (const description of [7, {}, 'x'.repeat(1001)]) {
      expect(() => decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, description }] }))
        .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 边界：正好 1000 字收下（与契约 `PluginDescription.maxLength` 对齐）。
    const boundary = 'y'.repeat(1000)
    expect(decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, description: boundary }] })
      .catalog?.[0]?.description).toBe(boundary)
    // 真实制品那条 347 字符的描述（@mengli114/dsh-settings-nav-collapse）：旧的 300 闸连解码层都会
    // 把它判成畸形（ENT_LOCAL_RESPONSE_INVALID），故这里用真值锁住它必须被整条照收。
    const real347 = 'DSH web client plugin: one toggle in the settings panel header collapses the settings navigation'
      + ' column into a narrow icon rail, so the settings content keeps a readable width on phones and other narrow'
      + " viewports. The panel is located at runtime from the plugin's own node (no package-internal attribute), and"
      + ' the choice is remembered per browser.'
    expect(real347).toHaveLength(347)
    expect(decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, description: real347 }] })
      .catalog?.[0]?.description).toBe(real347)
  })

  // 取消在途安装（本刀）：与 install/remove 同族同源——方法 / 路径 / body 逐字断言；
  // 响应就是只读 `GET /plugins` 那份**同形**投影（Host 零新增字段），故走的仍是同一个严格解码器。
  it('sends the cancel command to its exact same-origin route with the closed one-key body', async () => {
    const item = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = { assignmentRevision: 7, catalog: [item], plugins: [] }
    const fetcher = vi.fn(async () => ok(status))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.cancelPlugin(item.packageName, signal)).resolves.toEqual(status)
    // 路径常量与 Host 的 exact 注册面逐字相同（`platform-client` 的 `ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH`）。
    expect(ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH).toBe('/enterprise/api/v1/local/plugins/cancel')
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ packageName: item.packageName }), cache: 'no-store', signal,
    }))
    // 正文是**关闭键集**：恰好一个键、键名逐字（多一个键 Host 侧就 400）。
    expect(Object.keys(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)))).toEqual(['packageName'])
    // 响应走同一个严格解码器：多加一个字段即整条判畸形（「零新增字段」的机械保证）。
    const leaky = createEnterpriseLocalApi(vi.fn(async () => ok({ ...status, cancelled: true })))
    await expect(leaky.cancelPlugin(item.packageName, signal)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  it('uses same-origin fixed paths and strict empty-object POST actions', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/status')) return ok(STATUS)
      if (path.endsWith('/auth/start')) return ok({ flowId: 'flow-1' })
      if (path.endsWith('/auth/cancel')) return ok({ cancelled: true })
      if (path.endsWith('/logout')) return ok({ loggedOut: true })
      if (path.endsWith('/server')) return ok({ serverUrl: 'https://next.example.com' })
      if (path.endsWith('/uninstall')) return ok({ uninstalled: true, restartRequested: false })
      throw new Error(`unexpected path ${path}`)
    })
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.status(signal)).resolves.toEqual(STATUS)
    await expect(api.startLogin(signal)).resolves.toEqual({ flowId: 'flow-1' })
    await expect(api.cancelLogin(signal)).resolves.toEqual({ cancelled: true })
    await expect(api.logout(signal)).resolves.toEqual({ loggedOut: true })
    await expect(api.setServerUrl('https://next.example.com', signal)).resolves.toEqual({
      serverUrl: 'https://next.example.com',
    })
    await expect(api.uninstall(signal)).resolves.toEqual({ uninstalled: true, restartRequested: false })

    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      '/enterprise/api/v1/local/status',
      '/enterprise/api/v1/local/auth/start',
      '/enterprise/api/v1/local/auth/cancel',
      '/enterprise/api/v1/local/logout',
      '/enterprise/api/v1/local/server',
      '/enterprise/api/v1/local/uninstall',
    ])
    for (const call of [1, 2, 3, 5].map(index => fetcher.mock.calls[index])) {
      expect(call[1]).toMatchObject({ body: '{}', method: 'POST' })
      expect(new Headers(call[1]?.headers).get('authorization')).toBeNull()
    }
    expect(fetcher.mock.calls[4]?.[1]).toMatchObject({
      body: '{"serverUrl":"https://next.example.com"}', method: 'POST',
    })
  })

  it('uses same-origin fixed paths for the skill catalog and its detail, dropping SHA from the projection', async () => {
    const summary = {
      id: '7001',
      skillId: 'code-review-ent',
      displayName: '企业代码评审技能包',
      description: '企业统一的代码评审检查单',
      sourceDshVersion: '0.2.0-rc.2',
      sizeBytes: 2048,
      skillCount: 1,
      updatedAt: '2026-09-30T10:00:00Z',
    }
    const detail = {
      ...summary,
      versionId: '9001',
      sha256: 'a'.repeat(64),
      skills: [{ name: 'code-review', description: '按检查单评审改动', modelInvocable: true, userInvocable: true }],
    }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/skills')) return ok([summary])
      if (path.endsWith('/skills/7001')) return ok(detail)
      throw new Error(`unexpected path ${path}`)
    })
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.skills(signal)).resolves.toEqual([{ ...summary, versionId: '', skills: [] }])
    const projected = await api.skillDetail('7001', signal)
    expect(projected).toMatchObject({ versionId: '9001', skillCount: 1 })
    expect(JSON.stringify(projected)).not.toMatch(/sha256/i)
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      '/enterprise/api/v1/local/skills',
      '/enterprise/api/v1/local/skills/7001',
    ])
  })

  // 已装技能正文（点技能行看详情时发的唯一一条新请求）：同源固定路径 + 两个**标识符**查询参数
  // （不是路径），参数一律 `encodeURIComponent` 后拼上——界面从不拼宿主路径。
  it('reads an installed skill body over one same-origin path with encoded identifier query parameters', async () => {
    const body = { packageId: '7001', name: 'code-review', content: '# 正文\n- 检查单' }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.startsWith('/enterprise/api/v1/local/skills/content?')) {
        return new Response(JSON.stringify({ data: body }), { headers: { 'content-type': 'application/json' } })
      }
      throw new Error(`unexpected path ${path}`)
    })
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.skillContent('7001', 'code-review', new AbortController().signal)).resolves.toEqual(body)
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      '/enterprise/api/v1/local/skills/content?packageId=7001&name=code-review',
    ])
    // 参数按标识符编码：带 `../` 之类的输入只会变成查询串里的字面量，永远不会成为路径片段。
    await api.skillContent('7001', '../../etc/passwd', new AbortController().signal).catch(() => undefined)
    expect(String(fetcher.mock.calls[1]?.[0]))
      .toBe('/enterprise/api/v1/local/skills/content?packageId=7001&name=..%2F..%2Fetc%2Fpasswd')
    // Host 多塞宿主路径等正文之外的字面量即整条判畸形（与其余投影同一条键集封闭口径）。
    const leaky = createEnterpriseLocalApi(vi.fn(async () => new Response(JSON.stringify({
      data: { ...body, path: '/data/user/0/x/SKILL.md' },
    }), { headers: { 'content-type': 'application/json' } })))
    await expect(leaky.skillContent('7001', 'code-review', new AbortController().signal))
      .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  // 本机技能**文件树**与**树里单个文件**（技能详情子页面左树右预览的两条同源取数）：路径段只放包 id、
  // 相对路径只进查询串且一律 `encodeURIComponent`——界面从不拼宿主路径，也不接受用户输入。
  it('reads the installed skill file tree and one text file over same-origin paths', async () => {
    const files = {
      packageId: '7001',
      entries: [
        { path: 'code-review', kind: 'directory', sizeBytes: 0 },
        { path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 2048 },
      ],
    }
    const file = { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 2048, text: '# 正文\n- 检查单' }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/7001/files')) return ok(files)
      if (path.startsWith('/enterprise/api/v1/local/skills/7001/file?')) return ok(file)
      throw new Error(`unexpected path ${path}`)
    })
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.skillFiles('7001', signal)).resolves.toEqual(files)
    await expect(api.skillFile('7001', 'code-review/SKILL.md', signal)).resolves.toEqual(file)
    expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
      '/enterprise/api/v1/local/skills/7001/files',
      '/enterprise/api/v1/local/skills/7001/file?path=code-review%2FSKILL.md',
    ])
    // 参数按标识符编码：`../` 之类只会变成查询串里的字面量，永远不会成为路径片段。
    await api.skillFile('7001', '../etc/passwd', signal).catch(() => undefined)
    expect(String(fetcher.mock.calls[2]?.[0]))
      .toBe('/enterprise/api/v1/local/skills/7001/file?path=..%2Fetc%2Fpasswd')
    // Host 多塞宿主绝对路径即整条判畸形（与其余投影同一条键集封闭口径）。
    const leaky = createEnterpriseLocalApi(vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/files')) {
        return ok({ ...files, entries: [...files.entries, { path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 1 }] })
      }
      return new Response(JSON.stringify({ data: { ...file, absolutePath: '/data/user/0/x/skills/code-review/SKILL.md' } }), {
        headers: { 'content-type': 'application/json' },
      })
    }))
    await expect(leaky.skillFiles('7001', signal)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(leaky.skillFile('7001', 'code-review/SKILL.md', signal)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  it('refreshes account state with one JSON request', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: STATUS }), {
      headers: { 'content-type': 'application/json' },
    }))
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.refresh(new AbortController().signal)).resolves.toEqual(STATUS)
    expect(fetcher).toHaveBeenCalledWith('/enterprise/api/v1/local/refresh', expect.objectContaining({
      method: 'POST', body: '{}',
    }))
    expect('events' in api).toBe(false)
  })

  // 原生登录（安卓）：来源列表与凭证结果的严格解码——多字段、错类型、越界键一律拒绝。
  it('strictly decodes the native login form and credential results', () => {
    expect(decodeEnterpriseLoginForm({ sources: [{ id: '19001', name: 'Local', type: 'LOCAL' }] }))
      .toEqual({ sources: [{ id: '19001', name: 'Local', type: 'LOCAL' }] })
    expect(decodeEnterpriseLoginForm({ sources: [] })).toEqual({ sources: [] })
    for (const bad of [
      {},
      { sources: 'nope' },
      { sources: [{ id: '1', name: 'Local', type: 'SAML' }] },
      { sources: [{ id: '', name: 'Local', type: 'LOCAL' }] },
      { sources: [{ id: '1', name: 'Local', type: 'LOCAL', extra: 1 }] },
      { sources: [{ id: '1', name: 'Local' }] },
      { sources: [{ id: '1', name: 'Local', type: 'LOCAL' }], captcha: {} },
    ]) {
      expect(() => decodeEnterpriseLoginForm(bad), JSON.stringify(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    expect(decodeEnterpriseCredentialResult({ next: 'redirect' })).toEqual({ next: 'redirect' })
    expect(decodeEnterpriseCredentialResult({ next: 'change-password', challenge: 'c-1', rejected: false }))
      .toEqual({ next: 'change-password', challenge: 'c-1', rejected: false })
    for (const bad of [
      {},
      { next: 'redirect', extra: 1 },
      { next: 'change-password', challenge: 'c-1' },
      { next: 'change-password', challenge: '', rejected: false },
      { next: 'change-password', challenge: 'c-1', rejected: 'yes' },
      { next: 'something-else' },
    ]) {
      expect(() => decodeEnterpriseCredentialResult(bad), JSON.stringify(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

})
