/**
 * [INPUT]: 依赖 dsh-ui 同源 local-api、标准 Response 与 EventSource test double
 * [OUTPUT]: 验证账号/插件/技能严格解码、地址/卸载固定路径、脱敏投影、显式刷新与秘密字段拒绝，**本刀（登录入口换成 NUWAX，+2 条）**：NUWAX 三条路径常量逐字 + 登录正文关闭键集 `{account,password}` + 口令不进 URL/请求头 + 登录态解码（`ticket` 键、两态与主体不匹配、非整数 `uid`/`expiresAt` 一律畸形），**已装技能正文取数**（同源 `/skills/content` + 两个标识符查询参数按 `encodeURIComponent` 编码、键集封闭拒绝宿主路径与超限正文），以及**本刀新增的详情子页面两条取数**——本机**文件树** `/skills/<id>/files` 与**树里单个文本文件** `/skills/<id>/file?path=`（相对路径只进查询串且一律 `encodeURIComponent`、Host 多塞宿主绝对路径或树内重复路径即 `ENT_LOCAL_RESPONSE_INVALID`） **本刀（企业插件真取消）新增**：`cancelPlugin` 的方法 / 路径 / body 逐字断言（`POST /enterprise/api/v1/local/plugins/cancel`、正文关闭键集恰好 `{packageName}`、路径常量与 Host 注册面同值），以及「响应仍是同一个严格解码器（多一个字段即畸形）」
 * **本刀（系统搜索，+2 条）**：盘点那条只读面（`GET /skills/system-search`：根三键/候选五键封闭、三态字面、
 *   候选的 `rootId` 必须在 `roots` 里、路径去重、两处封顶、两枚可选文本缺席即无键）与纳入那条动作路由
 *   （`POST /skills/adopt`：路径常量逐字、正文关闭键集恰好 `{path}`、响应**复用** self-installed 那一个解码器
 *   ——必备五键仍严格、provenance 类留痕字段按设计容忍）。
 * **本刀（在线搜索，+2 条）**：搜索那条只读面（`GET /skills/online-search?q=…`：信封单键封闭、来源两键
 *   （+可选 `dropped`，**只允许正数**）封闭、`ok` 布尔、结果三键（+四枚可选）封闭、两枚计数非负安全整数、
 *   结果的 `sourceId` 必须在 `sources` 里、来源 id 去重与两处封顶；且**陌生来源 id 照旧解得开**——
 *   Host 可增源，写死字面集会让良性变化变成整次搜索失败）与在线安装那条动作路由
 *   （`POST /skills/install-from-result`：路径常量逐字、正文关闭键集恰好 `{source}`、响应**复用**
 *   已装态那一个解码器）。
 * [POS]: dsh-ui 浏览器网络边界测试，确保浏览器只能消费 Host 脱敏 DTO **本刀（本地导入，+2 条）**：上传那条 multipart 路由（`POST /enterprise/api/v1/local/skills/upload`、`FormData` 里**恰好一个** `artifact` file part、文件名原样带上、响应沿用**同一个**已装态严格解码器）与本机自装清单那条只读面（`GET …/skills/self-installed`：可选第六件 `sourceInput` 收下、provenance 多字段容忍、五枚必备事实仍严格）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createEnterpriseLocalApi,
  decodeEnterpriseCredentialResult,
  decodeEnterpriseLoginForm,
  decodeEnterprisePluginStatus,
  decodeEnterpriseLocalStatus,
  decodeEnterpriseOnlineSkillSearch,
  decodeEnterpriseSelfInstalledSkills,
  decodeEnterpriseSystemSkills,
  ENTERPRISE_CONNECTION_STATES,
  ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH,
  ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH,
  ENTERPRISE_NUWAX_STATUS_LOCAL_PATH,
  ENTERPRISE_PLUGIN_CANCEL_LOCAL_PATH,
  ENTERPRISE_PLUGIN_DISABLE_LOCAL_PATH,
  ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH,
  ENTERPRISE_SKILL_ADOPT_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH,
  ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH,
  ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH,
  ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH,
  ENTERPRISE_SKILL_UPLOAD_FIELD,
  ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH,
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
            // 旧 Host（投影里没有启停位）⇒ 归一成「启用」；客户端**绝不**从 `state` 反推。
            enabled: true,
          }],
        })
    }
    // 启停位在场时如实收下（已安装·已停用那一格），且它**与「装没装」正交**（desiredState 照旧）。
    expect(decodeEnterprisePluginStatus({
      assignmentRevision: 7, plugins: [{ ...PLUGIN, state: 'ACTIVE', enabled: false }],
    })).toEqual({
      assignmentRevision: 7,
      plugins: [{
        packageName: PLUGIN.packageName,
        version: PLUGIN.version,
        desiredRevision: 7,
        desiredState: 'INSTALLED',
        state: 'ACTIVE',
        lastErrorCode: null,
        enabled: false,
      }],
    })
    // 形状不对的启停位照样拒（它不是「真值随便收」的自由字段）。
    expect(() => decodeEnterprisePluginStatus({
      assignmentRevision: 7, plugins: [{ ...PLUGIN, enabled: 'yes' }],
    })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
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

  // **反向锁（插件侧没有 category）**：早先这里凭「与技能侧对称」给 catalog 条目加过一个 `category` 字段
  // （解码 + 行模型 + 注释全套），但**插件侧服务端零落库、零投影，契约 plugin.yaml 也无此键**
  // （三条独立证据链全零命中）⇒ 那段解码永远读不到值，是凭对称性编出来的假上游。
  // **插件分类待后端另开一刀**（加列 + 投影 + 契约字段）后才接；在此之前插件行恒无分类，
  // 分组一律落「其他」（`enterpriseMarketCategoryGroups` 拿不到值即归兜底格）。
  // 这条锁的作用是：**防止下一个人再次凭「技能侧有、插件侧也该有」的直觉把它加回来。**
  it('keeps category out of the plugin catalog shape (no upstream column, no contract field)', () => {
    const base = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = { assignmentRevision: 7, plugins: [] }
    // 解码后的条目上根本没有这个键（不是 undefined 值、是被彻底删掉的那个键）。
    const decoded = decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base }] })
    expect(decoded.catalog?.[0]).not.toHaveProperty('category')
    // 上游若真发来这个键，按**闭集键校验**判畸形（而不是悄悄收下）——与「契约里没有它」一致。
    expect(() => decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, category: '精选' }] }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  // 口径 20（描述来自 README）：catalog 里新增的**可选** `readme` 与同侧 `description` 同一口径归一——
  // 缺席 / null / 空串一律「没有这个键」（详情据此**回落短描述**），非 string 非 null 或超过契约上限判畸形。
  it('normalizes the optional catalog readme like the description, without ever reading its content', () => {
    const base = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = { assignmentRevision: 7, plugins: [] }
    // 有 README：**逐字节原样**收下（Markdown 记号、原始换行、HTML 样文本一个字符都不动——
    // 它是数据不是指令，本层不解析 Markdown、不查标签、不 trim）。
    const readme = '# Acme 工具箱\n\n把代码审查规则带进新会话。\n\n<b>这不是 HTML</b>\n'
    expect(decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, readme }] })
      .catalog?.[0]?.readme).toBe(readme)
    // 三种「没有 README」的形态都归一成**没有这个键**（不是空串、不是 null）。
    for (const readme of [undefined, null, '']) {
      const decoded = decodeEnterprisePluginStatus({
        ...status,
        catalog: [{ ...base, ...(readme === undefined ? {} : { readme }) }],
      })
      expect(decoded.catalog?.[0], String(readme)).not.toHaveProperty('readme')
    }
    // 形状不对（非 string 非 null）与超过契约上限（65536）一律判畸形，绝不静默截断或猜。
    for (const readme of [7, {}, 'x'.repeat(65_537)]) {
      expect(() => decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, readme }] }))
        .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 边界：正好 65536 字收下（与契约 `PluginReadme.maxLength` 对齐）。
    const boundary = 'y'.repeat(65_536)
    expect(decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, readme: boundary }] })
      .catalog?.[0]?.readme).toBe(boundary)
    // README 与短描述**并存**：两枚键各自原样保留，回落判定不归本层（归渲染层的唯一投影）。
    const both = decodeEnterprisePluginStatus({
      ...status, catalog: [{ ...base, readme, description: '短描述。' }],
    })
    expect(both.catalog?.[0]?.readme).toBe(readme)
    expect(both.catalog?.[0]?.description).toBe('短描述。')
  })

  // 本刀（卡片标题 = 插件名称）：catalog 里新增的**可选** `displayName` 与同侧 `description` 同一口径归一——
  // 缺席 / null / 空串一律「没有这个键」（渲染层据此**回退包名**，绝不画空标题），非 string 非 null
  // 或超过契约上限（`PluginDisplayName.maxLength` = 120）一律判畸形。
  it('normalizes the optional catalog displayName with the package-name fallback left to the renderer', () => {
    const base = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = { assignmentRevision: 7, plugins: [] }
    // 有显示名：收下并保留原值（不改写、不 trim、不截断）——卡片标题就用它。
    const named = decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, displayName: 'Acme 工具箱' }] })
    expect(named.catalog?.[0]?.displayName).toBe('Acme 工具箱')
    // 三种「没有显示名」的形态都归一成**没有这个键**（不是空串、不是 null）⇒ 渲染层回退包名。
    for (const displayName of [undefined, null, '']) {
      const decoded = decodeEnterprisePluginStatus({
        ...status,
        catalog: [{ ...base, ...(displayName === undefined ? {} : { displayName }) }],
      })
      expect(decoded.catalog?.[0], String(displayName)).not.toHaveProperty('displayName')
    }
    // 形状不对（非 string 非 null）与超过契约上限（120）一律判畸形，绝不静默截断或猜。
    for (const displayName of [7, {}, 'x'.repeat(121)]) {
      expect(() => decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, displayName }] }))
        .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 边界：正好 120 字收下（与服务端 `PluginDisplayName.maxLength` 对齐）。
    const boundary = 'y'.repeat(120)
    expect(decodeEnterprisePluginStatus({ ...status, catalog: [{ ...base, displayName: boundary }] })
      .catalog?.[0]?.displayName).toBe(boundary)
  })

  // NUWAX 三条（本刀：登录入口换成 NUWAX）：两条动作 + 一条只读。三条路径各自逐字断言，
  // 登录正文是**关闭键集**恰好 `{account,password}`，两处响应都走同一个严格解码器。
  it('sends the NUWAX login over its exact route with the closed two-key body and locks all three paths', async () => {
    const signedIn = {
      state: 'signed-in',
      // 服务地址随投影一起过来（界面页脚显示「这次登录打到哪台」；是地址不是凭据）。
      origin: 'https://agent.sunoasis.com.cn',
      principal: { uid: 538565, userName: '538565', nickName: '李猛', tenantId: 1 },
      expiresAt: 1_000,
    }
    const fetcher = vi.fn(async () => ok(signedIn))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal

    await expect(api.nuwaxLogin('538565', 'p@ss', signal)).resolves.toEqual(signedIn)
    expect(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/login')
    const loginCall = fetcher.mock.calls.at(-1)
    expect(loginCall?.[0]).toBe(ENTERPRISE_NUWAX_LOGIN_LOCAL_PATH)
    expect(loginCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST', body: JSON.stringify({ account: '538565', password: 'p@ss' }), cache: 'no-store', signal,
    }))
    // 正文是**关闭键集**：恰好两个键、键名逐字（多一个键 Host 侧就 400）。
    expect(Object.keys(JSON.parse(String(loginCall?.[1]?.body)))).toEqual(['account', 'password'])
    // ★口令只进正文：URL 与请求头里都不许出现它。
    expect(loginCall?.[0]).not.toContain('p@ss')
    expect(JSON.stringify(loginCall?.[1]?.headers)).not.toContain('p@ss')

    // 只读那条：同源 GET（`getInit` 不写 method）、无正文。
    await expect(api.nuwaxStatus(signal)).resolves.toEqual(signedIn)
    expect(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/status')
    const statusCall = fetcher.mock.calls.at(-1)
    expect(statusCall?.[0]).toBe(ENTERPRISE_NUWAX_STATUS_LOCAL_PATH)
    expect(statusCall?.[1]?.method).toBeUndefined()

    // 登出那条：同源 POST，响应无正文 ⇒ 成不成只看 2xx。
    await expect(api.nuwaxLogout(signal)).resolves.toBeUndefined()
    expect(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH).toBe('/enterprise/api/v1/local/nuwax/logout')
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe(ENTERPRISE_NUWAX_LOGOUT_LOCAL_PATH)
    expect(fetcher.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({ method: 'POST', signal }))
  })

  it('refuses a NUWAX projection that leaks the ticket or breaks the two-state shape', async () => {
    const principal = { uid: 1, userName: 'u', nickName: 'n', tenantId: 1 }
    const decode = async (data: unknown) => await createEnterpriseLocalApi(vi.fn(async () => ok(data)))
      .nuwaxStatus(new AbortController().signal)
    // ★票据绝不进浏览器契约：多一个 `ticket` 键即整条判畸形（宿主本就不发，这里再挡一层）。
    await expect(decode({ state: 'signed-in', principal, ticket: 'secret' })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // 两态与主体**同生共死**：少了它会把「已登录」画成空账号，多了它会把「已登出」画成已登录。
    await expect(decode({ state: 'signed-in' })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(decode({ state: 'signed-out', principal })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // 态与主体字段各自有形状门禁。
    await expect(decode({ state: 'refreshing' })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(decode({ state: 'signed-in', principal: { ...principal, uid: '1' } })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(decode({ state: 'signed-in', principal, expiresAt: 1.5 })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // 服务地址：**可缺席**（部署显式停用 ⇒ 界面画占位），但在场必须是非空字符串——
    // 空串会让页脚画出一片空白，比"读不到"更坏。
    await expect(decode({ state: 'signed-out', origin: '' })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(decode({ state: 'signed-out', origin: 123 })).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    await expect(decode({ state: 'signed-out', origin: 'https://nuwax.example.com' }))
      .resolves.toEqual({ state: 'signed-out', origin: 'https://nuwax.example.com' })
    await expect(decode({ state: 'signed-out' })).resolves.toEqual({ state: 'signed-out' })
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

  // 启用 / 停用（本刀）：两条**独立**的同源路径（方向由路径决定，正文仍然只有 `{packageName}`），
  // 响应与只读 `GET /plugins` 同形（Host 只多那一枚启停位 `enabled`）。
  it('sends enable and disable to their own exact same-origin routes with the closed one-key body', async () => {
    const item = {
      pluginVersionId: '880', packageName: '@example/tools', version: '1.0.0', sizeBytes: 100,
      operatingSystems: ['darwin'],
    }
    const status = {
      assignmentRevision: 7,
      catalog: [item],
      plugins: [{
        packageName: item.packageName, version: '1.0.0', sha256: 'a'.repeat(64), desiredRevision: 7,
        desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null, restartMarker: null, enabled: false,
      }],
    }
    const fetcher = vi.fn(async () => ok(status))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    // 停用：走 `/plugins/disable`，收下后那一枚启停位如实是 false（界面不自行翻开关）。
    await expect(api.setPluginEnabled(item.packageName, false, signal)).resolves.toEqual({
      assignmentRevision: 7,
      catalog: [item],
      plugins: [{
        packageName: item.packageName, version: '1.0.0', desiredRevision: 7,
        desiredState: 'INSTALLED', state: 'ACTIVE', lastErrorCode: null, enabled: false,
      }],
    })
    expect(ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH).toBe('/enterprise/api/v1/local/plugins/enable')
    expect(ENTERPRISE_PLUGIN_DISABLE_LOCAL_PATH).toBe('/enterprise/api/v1/local/plugins/disable')
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_PLUGIN_DISABLE_LOCAL_PATH, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ packageName: item.packageName }), cache: 'no-store', signal,
    }))
    // 方向由**路径**决定（不是 body 里多一个 `enabled` 布尔）：正文恒是关闭键集恰好 `{packageName}`。
    expect(Object.keys(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)))).toEqual(['packageName'])
    // 启用：另一条路径。
    await api.setPluginEnabled(item.packageName, true, signal)
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_PLUGIN_ENABLE_LOCAL_PATH, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ packageName: item.packageName }),
    }))
    expect(Object.keys(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)))).toEqual(['packageName'])
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
      // 契约 `RuntimeSkillSummary.builtin`（必填 boolean；服务端恒发真值）。
      builtin: false,
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

  /**
   * **本刀（本地导入）**：上传那条 multipart 路由与它的响应解码。
   *
   * 三件事一起锁：① 路径常量与 Host 的 exact 注册面逐字相同；② 正文是 multipart（`FormData`）
   * ——**恰好一个** file part、字段名逐字 `artifact`、文件名原样带上（它是 Host 的展示事实，不拼路径）；
   * ③ 响应与 `POST /skills/install` **同形** ⇒ 走的仍是**同一个**严格解码器（不为上传新写第二套）。
   */
  it('uploads one selected file to the exact multipart route, reusing the installed-skills decoder', async () => {
    const installed = {
      packageId: '7001',
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      versionId: '8001',
      sha256: 'a'.repeat(64),
      names: ['meeting-notes'],
      installedAt: '2026-10-05T08:00:00.000Z',
    }
    const fetcher = vi.fn(async () => ok({ skills: [installed] }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'meeting-notes.dshskill', { type: 'application/zip' })
    await expect(api.uploadSkill(file, signal)).resolves.toEqual([installed])
    expect(ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/upload')
    expect(ENTERPRISE_SKILL_UPLOAD_FIELD).toBe('artifact')
    const [path, init] = fetcher.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_SKILL_UPLOAD_LOCAL_PATH)
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', signal })
    // 浏览器**只发用户选中的那份字节**：正文里没有任何宿主路径（本文件的既有边界口径）。
    const body = init?.body
    expect(body).toBeInstanceOf(FormData)
    expect([...((body as FormData).keys())]).toEqual([ENTERPRISE_SKILL_UPLOAD_FIELD])
    const part = (body as FormData).get(ENTERPRISE_SKILL_UPLOAD_FIELD)
    expect(part).toBeInstanceOf(File)
    expect((part as File).name).toBe('meeting-notes.dshskill')
    expect(await (part as File).arrayBuffer()).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer)
    // 响应与 `/skills/install` 同形 ⇒ 同一个严格解码器：多一枚字段即整条判畸形。
    const leaky = createEnterpriseLocalApi(vi.fn(async () => ok({ skills: [{ ...installed, provenance: 'upload' }] })))
    await expect(leaky.uploadSkill(file, signal)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  /**
   * **本刀（本地导入）**：本机自装清单那条只读面。
   *
   * 它是**另一份记录**（自装包没有中心雪花 id，故不在 `/skills/installed` 那份里），界面靠它说出
   * 「这次装好了哪几个技能」。解码**刻意宽容**：Host 多附的来源留痕字段一律忽略（不能因为「多说了
   * 一句来源」就把整句反馈判成畸形），但五枚必备事实的形状仍然严格（缺一枚 / names 为空即畸形）。
   */
  it('reads the self-installed catalogue over its own route and tolerates the provenance fields', async () => {
    const record = {
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      sha256: 'a'.repeat(64),
      names: ['meeting-notes'],
      installedAt: '2026-10-05T08:00:00.000Z',
      // Host 侧如实填的两枚 provenance（§F.4）——界面只关心 `sourceInput`（用户原始文件名）。
      sourceType: 'upload',
      sourceInput: 'meeting-notes.dshskill',
    }
    const fetcher = vi.fn(async () => ok({ skills: [record] }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.selfInstalledSkills(signal)).resolves.toEqual([{
      skillId: 'meeting-notes',
      displayName: '会议纪要技能组',
      sha256: 'a'.repeat(64),
      names: ['meeting-notes'],
      installedAt: '2026-10-05T08:00:00.000Z',
      sourceInput: 'meeting-notes.dshskill',
    }])
    expect(ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/self-installed')
    // 只读那条面：GET（默认方法，故 init 里不显式写 method）、无正文、带 abort 信号。
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_SKILL_SELF_INSTALLED_LOCAL_PATH, expect.objectContaining({
      cache: 'no-store', signal,
    }))
    const [, readInit] = fetcher.mock.calls[0]!
    expect(readInit?.body).toBeUndefined()
    expect(readInit?.method).toBeUndefined()
    // 老 Host 不给 `sourceInput`（可选第六件）照样解得出——只少半句「装好了哪几个」，不判死整条记录。
    const withoutInput = createEnterpriseLocalApi(vi.fn(async () => ok({
      skills: [{ skillId: 'x', displayName: 'X', sha256: 'b'.repeat(64), names: ['x'], installedAt: '2026-10-05T08:00:00.000Z' }],
    })))
    await expect(withoutInput.selfInstalledSkills(signal)).resolves.toEqual([{
      skillId: 'x', displayName: 'X', sha256: 'b'.repeat(64), names: ['x'], installedAt: '2026-10-05T08:00:00.000Z',
    }])
    // 必备五件仍然严格：缺一枚键、names 为空、信封形状不对 ⇒ 显式失败（绝不假装「没有自装技能」）。
    for (const bad of [
      { skills: [{ displayName: 'X', sha256: 'b'.repeat(64), names: ['x'], installedAt: '2026-10-05T08:00:00.000Z' }] },
      { skills: [{ ...record, names: [] }] },
      { skills: 'nope' },
      {},
    ]) {
      await expect(createEnterpriseLocalApi(vi.fn(async () => ok(bad))).selfInstalledSkills(signal))
        .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 纯解码入口也能直接用（与浏览器 API 同一条判据）。
    expect(decodeEnterpriseSelfInstalledSkills({ skills: [record] })).toHaveLength(1)
  })

  /**
   * **本刀（系统搜索）**：盘点那条只读面 + 它的严格解码。
   *
   * 严格三条一起锁：① 信封单键封闭 `{roots, skills}`；② 根三键 / 候选五键（+两枚可选）封闭、
   * `state` 只能是三字面；③ **每条候选的 `rootId` 必须在 `roots` 里**（界面按根分组铺设，
   * 指向不存在根的候选没有诚实落点）＋ 路径去重与两处条数封顶。
   */
  it('reads the system skill roots over their own read-only route with a key-closed projection', async () => {
    const roots = [
      { id: 'user-dsh', path: '/data/user/0/com.deepcode.shell/files/.dsh/skills', present: true },
      { id: 'other-cli', path: '/opt/other/skills', present: false },
    ]
    const skills = [
      {
        path: '/data/user/0/com.deepcode.shell/files/.dsh/skills/code-review',
        rootId: 'user-dsh',
        name: 'code-review',
        displayName: '代码审查',
        description: '把代码审查规则带进新会话。',
        state: 'available',
      },
      { path: '/data/user/0/com.deepcode.shell/files/.dsh/skills/taken', rootId: 'user-dsh', name: 'taken', state: 'registered' },
    ]
    const fetcher = vi.fn(async () => ok({ roots, skills }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.systemSearch(signal)).resolves.toEqual({ roots, skills })
    expect(ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/system-search')
    // 只读那条面：GET（默认方法、无正文）+ 三件既有纪律（no-store / abort / accept）。
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH, expect.objectContaining({
      cache: 'no-store', signal,
    }))
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined()
    // 纯解码入口同一条判据；两枚可选文本缺席时不产出那个键（不是空串）。
    expect(decodeEnterpriseSystemSkills({ roots, skills }).skills[1]).toEqual({
      path: '/data/user/0/com.deepcode.shell/files/.dsh/skills/taken', rootId: 'user-dsh', name: 'taken', state: 'registered',
    })
    // 可选文本口径**照本文件既有那两枚**（`whenToUse`/`category`）：缺席 / null / 空串都归一成「没有这个键」，
    // 只有类型不对或超上限才判畸形（一份写着空描述的 SKILL.md 不该让整个盘点失败）。
    for (const empty of [undefined, null, '']) {
      expect(decodeEnterpriseSystemSkills({
        roots, skills: [{ path: '/x/y', rootId: 'user-dsh', name: 'y', state: 'available', displayName: empty, description: empty }],
      }).skills[0]).toEqual({ path: '/x/y', rootId: 'user-dsh', name: 'y', state: 'available' })
    }
    const candidate = () => ({ path: '/x/y', rootId: 'user-dsh', name: 'y', state: 'available' })
    for (const [label, bad] of [
      ['信封多一枚键', { roots, skills, extra: 1 }],
      ['根多一枚键', { roots: [{ ...roots[0], extra: 1 }], skills: [] }],
      ['根 present 不是布尔', { roots: [{ ...roots[0], present: 'true' }], skills: [] }],
      ['候选多一枚键', { roots, skills: [{ ...candidate(), extra: 1 }] }],
      ['state 不是三字面', { roots, skills: [{ ...candidate(), state: 'unknown' }] }],
      ['候选的 rootId 不在 roots 里', { roots, skills: [{ ...candidate(), rootId: 'nowhere' }] }],
      ['两枚候选同一条路径（Host 已按 canonical 去重）', { roots, skills: [candidate(), candidate()] }],
      ['目录名不是官方 kebab', { roots, skills: [{ ...candidate(), name: 'Not Kebab' }] }],
      ['路径含控制字符', { roots, skills: [{ ...candidate(), path: '/x/\u0000y' }] }],
      ['路径超长（与 Host 的 1024 同值）', { roots, skills: [{ ...candidate(), path: `/x/${'y'.repeat(1024)}` }] }],
      ['displayName 类型不对（非字符串）', { roots, skills: [{ ...candidate(), displayName: 42 }] }],
      ['description 超上限', { roots, skills: [{ ...candidate(), description: 'z'.repeat(1025) }] }],
      ['roots 不是数组', { roots: {}, skills: [] }],
      ['skills 不是数组', { roots, skills: {} }],
    ] as const) {
      expect(() => decodeEnterpriseSystemSkills(bad), label).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      await expect(createEnterpriseLocalApi(vi.fn(async () => ok(bad))).systemSearch(signal), label)
        .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  /**
   * **本刀（系统搜索 → 纳入）**：纳入那条动作路由。
   *
   * ① 路径常量与 Host 的 exact 注册面逐字相同（否则 `adopt` 会被 `/skills` 前缀当包 id）；
   * ② 正文是**关闭键集恰好 `{path}`**（多一个键、非字符串、空串、超长都在 Host 侧 400，这里逐字锁住我们只发这一个键）；
   * ③ 响应与 `GET /skills/self-installed` **逐字同形** ⇒ 走的仍是**同一个**严格解码器（Host 回畸形即失败，
   *    不会被当成「纳入成功」）。
   */
  it('sends the adopt command to its exact same-origin route with the closed one-key body', async () => {
    const canonical = '/data/user/0/com.deepcode.shell/files/.dsh/skills/code-review'
    const record = {
      skillId: 'code-review',
      displayName: '代码审查',
      sha256: 'a'.repeat(64),
      names: ['code-review'],
      installedAt: '2026-10-06T08:00:00.000Z',
      sourceType: 'system',
      sourceInput: canonical,
    }
    const fetcher = vi.fn(async () => ok({ skills: [record] }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.adoptSystemSkill(canonical, signal)).resolves.toEqual([{
      skillId: 'code-review',
      displayName: '代码审查',
      sha256: 'a'.repeat(64),
      names: ['code-review'],
      installedAt: '2026-10-06T08:00:00.000Z',
      sourceInput: canonical,
    }])
    expect(ENTERPRISE_SKILL_ADOPT_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/adopt')
    const [, init] = fetcher.mock.calls[0]!
    expect(init).toMatchObject({
      method: 'POST', body: JSON.stringify({ path: canonical }), cache: 'no-store', signal,
    })
    expect(Object.keys(JSON.parse(String(init?.body)))).toEqual(['path'])
    // 用的是**同一个**解码器：它对自己的**必备五键**仍然严格（缺键 / names 为空 / 信封形状不对 ⇒ 整条失败），
    // 故「Host 回了畸形」绝不会被当成「纳入成功」。
    for (const bad of [
      { skills: [{ ...record, skillId: undefined }] },
      { skills: [{ ...record, names: [] }] },
      { skills: 'nope' },
    ]) {
      await expect(createEnterpriseLocalApi(vi.fn(async () => ok(bad))).adoptSystemSkill(canonical, signal))
        .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 而 provenance 这类**留痕字段**按设计容忍（与 `GET /skills/self-installed` **逐字同一份**宽容口径：
    // 多一句来源不该把一次成功的纳入判成失败）——这条同时证明两条路真的共用同一个解码器。
    await expect(createEnterpriseLocalApi(vi.fn(async () => ok({
      skills: [{ ...record, provenance: 'system', resolvedUrl: 'file:///x' }],
    }))).adoptSystemSkill(canonical, signal)).resolves.toEqual([{
      skillId: 'code-review',
      displayName: '代码审查',
      sha256: 'a'.repeat(64),
      names: ['code-review'],
      installedAt: '2026-10-06T08:00:00.000Z',
      sourceInput: canonical,
    }])
  })

  /**
   * **本刀（在线搜索）**：搜索那条只读面 + 它的严格解码。
   *
   * 严格四条一起锁：① 信封单键封闭 `{sources, results}`；② 来源两键（+可选 `dropped`，**只允许正数**）
   * 封闭、`ok` 是布尔；③ 结果三键（+四枚可选）封闭、两枚计数非负安全整数；
   * ④ **结果的 `sourceId` 必须在 `sources` 里** ＋ 来源 id 去重与两处封顶。
   * ★ 另一条口径：来源 id **不做封闭字面集**（Host 可增源）——多一个陌生 id 照旧解得开、显示时用它当源名。
   */
  it('reads the online skill sources over their own read-only route with a key-closed projection', async () => {
    const sources = [
      { id: 'skills.sh', ok: false },
      { id: 'claude-plugins.dev', ok: true, dropped: 3 },
      { id: 'clawhub.ai', ok: true },
    ]
    const results = [
      {
        sourceId: 'clawhub.ai',
        name: 'code-review',
        description: '把代码审查规则带进新会话。',
        author: 'acme',
        stars: 1200,
        installs: 3400,
        installSource: 'skills-sh:acme/tools/code-review',
      },
      { sourceId: 'clawhub.ai', name: 'meeting-notes', installSource: 'clawhub.ai:acme/notes/meeting-notes' },
    ]
    const fetcher = vi.fn(async () => ok({ sources, results }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.onlineSearchSkills('code review', signal)).resolves.toEqual({ sources, results })
    expect(ENTERPRISE_SKILL_ONLINE_SEARCH_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/online-search')
    // 查询串进 `q` 并按标识符编码（空格、斜杠、中文都只变成查询串里的字面量）。
    expect(fetcher.mock.calls[0]?.[0]).toBe('/enterprise/api/v1/local/skills/online-search?q=code%20review')
    await api.onlineSearchSkills('a/b c', signal)
    expect(fetcher.mock.calls[1]?.[0]).toBe('/enterprise/api/v1/local/skills/online-search?q=a%2Fb%20c')
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined()
    // 两枚可选文本缺席时不产出那个键（不是空串）；`dropped` 为 0 时 Host 整键不产出，故这里也不该出现 0。
    expect(decodeEnterpriseOnlineSkillSearch({
      sources: [{ id: 'skills.sh', ok: true }],
      results: [{ sourceId: 'skills.sh', name: 'x', installSource: 'skills.sh:o/r/x', description: '', author: null }],
    })).toEqual({
      sources: [{ id: 'skills.sh', ok: true }],
      results: [{ sourceId: 'skills.sh', name: 'x', installSource: 'skills.sh:o/r/x' }],
    })
    // ★ 陌生来源 id 照旧解得开（Host 可增源；写死字面集会让良性变化变成整次搜索失败）。
    expect(decodeEnterpriseOnlineSkillSearch({
      sources: [{ id: 'brand-new.example', ok: true }],
      results: [{ sourceId: 'brand-new.example', name: 'x', installSource: 'brand-new.example:o/r/x' }],
    }).sources[0]?.id).toBe('brand-new.example')
    // 反锁：去重键是**坐标串**，不是技能名 —— 同名不同坐标是**合法**的两条（别把约束扩大成「技能名唯一」）。
    expect(decodeEnterpriseOnlineSkillSearch({
      sources: [{ id: 'skills.sh', ok: true }, { id: 'clawhub.ai', ok: true }],
      results: [
        { sourceId: 'skills.sh', name: 'x', installSource: 'skills.sh:o/r/x' },
        { sourceId: 'clawhub.ai', name: 'x', installSource: 'clawhub.ai:o/r/x' },
      ],
    }).results).toHaveLength(2)
    const candidate = () => ({ sourceId: 'skills.sh', name: 'x', installSource: 'skills.sh:o/r/x' })
    for (const [label, bad] of [
      ['信封多一枚键', { sources, results, extra: 1 }],
      ['来源多一枚键', { sources: [{ ...sources[0], extra: 1 }], results: [] }],
      ['来源 ok 不是布尔', { sources: [{ id: 'skills.sh', ok: 'true' }], results: [] }],
      ['dropped 为 0（Host 只在正数时产出）', { sources: [{ id: 'skills.sh', ok: true, dropped: 0 }], results: [] }],
      ['dropped 不是整数', { sources: [{ id: 'skills.sh', ok: true, dropped: 1.5 }], results: [] }],
      ['来源 id 重复', { sources: [{ id: 'skills.sh', ok: true }, { id: 'skills.sh', ok: false }], results: [] }],
      ['结果多一枚键', { sources, results: [{ ...candidate(), extra: 1 }] }],
      ['结果的 sourceId 不在 sources 里', { sources, results: [{ ...candidate(), sourceId: 'nowhere' }] }],
      ['stars 不是安全整数', { sources, results: [{ ...candidate(), stars: 1.5 }] }],
      ['stars 为负', { sources, results: [{ ...candidate(), stars: -1 }] }],
      ['installSource 空串', { sources, results: [{ ...candidate(), installSource: '' }] }],
      // ★ 本刀（复审整改）：坐标串是界面拿它当 React key、又把「这一行」对回原始结果的**唯一**依据
      //   ⇒ 重复必须在这里判死（否则轻则 key 冲突、重则「点第二行装的是第一行」）。
      ['installSource 重复', { sources, results: [candidate(), { ...candidate(), name: 'y' }] }],
      ['name 超上限', { sources, results: [{ ...candidate(), name: 'z'.repeat(201) }] }],
      ['description 类型不对', { sources, results: [{ ...candidate(), description: 42 }] }],
      ['sources 不是数组', { sources: {}, results: [] }],
      ['results 不是数组', { sources, results: {} }],
    ] as const) {
      expect(() => decodeEnterpriseOnlineSkillSearch(bad), label).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      await expect(createEnterpriseLocalApi(vi.fn(async () => ok(bad))).onlineSearchSkills('code', signal), label)
        .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  /**
   * **本刀（在线搜索 → 安装）**：在线安装那条动作路由。
   *
   * ① 路径常量与 Host 的 exact 注册面逐字相同；② 正文是**关闭键集恰好 `{source}`**；
   * ③ 响应与 `GET /skills/installed` **逐字同形** ⇒ 走的仍是**同一个**严格解码器。
   */
  it('sends the online install command to its exact same-origin route with the closed one-key body', async () => {
    const coordinate = 'skills-sh:acme/tools/code-review'
    const installed = {
      packageId: '7001',
      skillId: 'code-review',
      displayName: '代码审查',
      versionId: '8001',
      sha256: 'a'.repeat(64),
      names: ['code-review'],
      installedAt: '2026-10-07T08:00:00.000Z',
    }
    const fetcher = vi.fn(async () => ok({ skills: [installed] }))
    const api = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    await expect(api.installSkillFromResult(coordinate, signal)).resolves.toEqual([installed])
    expect(ENTERPRISE_SKILL_INSTALL_FROM_RESULT_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/install-from-result')
    const [, init] = fetcher.mock.calls[0]!
    expect(init).toMatchObject({
      method: 'POST', body: JSON.stringify({ source: coordinate }), cache: 'no-store', signal,
    })
    expect(Object.keys(JSON.parse(String(init?.body)))).toEqual(['source'])
    // 用的是**同一个**已装态解码器：必备键仍严格（缺键 / 多出来的越界字段都整条失败）。
    for (const bad of [
      { skills: [{ ...installed, packageId: undefined }] },
      { skills: [{ ...installed, provenance: 'github' }] },
      { skills: 'nope' },
    ]) {
      await expect(createEnterpriseLocalApi(vi.fn(async () => ok(bad))).installSkillFromResult(coordinate, signal))
        .rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
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
