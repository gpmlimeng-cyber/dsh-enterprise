/**
 * [INPUT]: 依赖 `src/connector-enable.ts` 的四段实现与常量、`src/esc-route.ts` 的**宿主内部读唯一入口** `readEnterpriseEscHostJson`、`src/nuwax-auth.ts` 的会话持有者、`tests/connector-enable-support.ts`（真 HTTP 假平台 / 官方管理面 double / 临时 dshHome）与 `tests/nuwax-support.ts`（持有者自己的隔离 dshHome）
 * [OUTPUT]: 锁定口径 67 Phase C D2 宿主半边的十条纪律——①取配置形状读不懂一律明确失败且**零落盘零安装** ②★`transport` 必须在场（patch 文本逐字断言 + 反锁「只有 url+headers」形态） ③★patch 文本里**绝不含 token**（真 token 进假平台响应 ⇒ patch 里只有那枚文件的绝对路径） ④凭据 0o700/0o600 + 原子写 + 无 `.tmp` 残留 ⑤官方管理面缺席/形状不对 ⇒ **不装** ⑥同一 mcpId 再启用 ⇒ 如实结果、不重复装 ⑦卸 = 官方 `removeBundle` + 删凭据（删不掉⇒抛） ⑧指纹不对 ⇒ 拒且零落盘零安装 ⑨码边界只在本面（技能族那枚文件一字不改） ⑩源码级无 `exec`/`spawn`/动态 import、不写 profile 文件
 * [POS]: D2 的宿主面回归门禁。★本文件**不主张**任何真机读数：平台形状全部按 `analysis/connector-plaza-probe.md` §1/§6 的冻结契约构造，官方安装面用**有形状闸门**的假件（它按官方契约读 spec 目录里那份 `package.json`）。有人把 `transport` 去掉、把 token 抄进 patch、把授权闸门挪到落盘之后、把官方失败当成成功、或者删凭据失败时吞掉异常，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONNECTOR_AUTHORIZATION_FILENAME,
  CONNECTOR_BUNDLE_PACKAGE_PREFIX,
  CONNECTOR_SECRET_FILE_MODE,
  CONNECTOR_SECRET_DIR_MODE,
  EnterpriseConnectorEnableError,
  MCP_CLIENT_MODULE,
  connectorAuthorizationPath,
  connectorBundleDirectory,
  connectorBundlePackageName,
  connectorBundleRoot,
  connectorEnableDisclosure,
  connectorEnableFingerprint,
  connectorEnablePortFromContext,
  connectorSecretPath,
  createEnterpriseConnectorEnable,
  isConnectorEnableManager,
  projectOfficialBundleSummaries,
  readConnectorAuthorizations,
  readConnectorBundleDirectory,
  readConnectorPlatformConfig,
  type ConnectorEnablePort,
  type EnterpriseConnectorEnable,
  type EnterpriseConnectorEnableErrorCode,
} from '../src/connector-enable.js'
import { readEnterpriseEscHostJson, type EnterpriseEscHostReadPort } from '../src/esc-route.js'
import { createNuwaxSessionHolder } from '../src/nuwax-auth.js'
import {
  PLATFORM_TOKEN,
  connectorDetailRow,
  createFakeOfficialManager,
  connectorEnableTempHome,
  disposeConnectorEnableHomes,
  disposeFakePlatforms,
  platformEnvelope,
  platformLoginReply,
  startFakePlatform,
  type FakeOfficialManager,
  type FakePlatform,
} from './connector-enable-support.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'correct horse battery staple'
const TICKET = 'connector-enable-ticket-must-not-leave-the-host'
const MCP_ID = '134'
const SERVER_NAME = 'qixinhuiyan-mcp'
const DETAIL_URL = 'https://mcp.qixin.example/mcp'
/** 平台那枚「真 token」：从支撑里取同一枚，免得两处各写一份（反向锁的探针必须是同一枚）。 */
const TOKEN = PLATFORM_TOKEN
/** 详情路径（D0 已放行的那条宿主内部三条之一）。 */
const DETAIL_PATH = `/api/mcp/${MCP_ID}`

afterEach(async () => {
  await disposeFakePlatforms()
  await disposeConnectorEnableHomes()
  // ★会话持有者带落盘：每份 holder 一份自己的 dshHome，否则上一份票据会被当成「重启后的登录态」读回来。
  disposeNuwaxTempHomes()
})

interface Harness {
  readonly home: string
  readonly platform: FakePlatform
  readonly official: FakeOfficialManager
  readonly kernel: EnterpriseConnectorEnable
}

/** 一台「真 HTTP 假平台 + 真宿主内部读入口 + 有形状闸门的官方管理面」的完整夹具。 */
async function makeHarness(): Promise<Harness> {
  const home = await connectorEnableTempHome()
  const platform = await startFakePlatform()
  platform.respond = path => platformLoginReply(path, TICKET)
  const holder = createNuwaxSessionHolder({
    fetch: (input, init) => fetch(input, init),
    origin: platform.origin,
    dshHome: nuwaxTempHome('connector-enable'),
  })
  await holder.login(ACCOUNT, PASSWORD)
  const readPort: EnterpriseEscHostReadPort = { holder, env: {} }
  const official = createFakeOfficialManager()
  const kernel = createEnterpriseConnectorEnable({
    port: official.port,
    readPlatformJson: path => readEnterpriseEscHostJson(readPort, path),
    dshHome: home,
    now: () => new Date('2026-10-09T00:00:00.000Z'),
  })
  return { home, platform, official, kernel }
}

/** 让假平台在登录两跳之外再服务详情那一跳。 */
function serveDetail(platform: FakePlatform, row: unknown, id = MCP_ID): void {
  platform.respond = path => platformLoginReply(path, TICKET)
    ?? (path === `/api/mcp/${id}` ? platformEnvelope(row) : undefined)
}

/** 员工确认用的指纹：走**导出**的两个纯函数（披露 → 指纹），绝不自己另算一份。 */
function confirmFor(row: unknown, id = MCP_ID): string {
  return connectorEnableFingerprint(connectorEnableDisclosure(readConnectorPlatformConfig(platformEnvelope(row).body, id)))
}

/** 这次合成落在哪几个摘要目录（正常恰好一个）。 */
async function bundleDigests(home: string, mcpId = MCP_ID): Promise<readonly string[]> {
  return (await readdir(join(connectorBundleRoot({ dshHome: home }), mcpId))).sort()
}

/** 读回合成物那两份正文。 */
async function readSynthesized(home: string, mcpId = MCP_ID): Promise<{
  readonly dir: string
  readonly packageJson: string
  readonly cordisPatch: string
}> {
  const digests = await bundleDigests(home, mcpId)
  expect(digests).toHaveLength(1)
  const dir = join(connectorBundleRoot({ dshHome: home }), mcpId, digests[0] as string)
  const files = await readConnectorBundleDirectory(dir)
  expect(files).toBeDefined()
  return { dir, packageJson: (files as { packageJson: string }).packageJson, cordisPatch: (files as { cordisPatch: string }).cordisPatch }
}

/** 跑一次 enable 并把抛出来的错误交回（断言稳定码用）。 */
async function failCode(promise: Promise<unknown>): Promise<{ code?: string; step?: string }> {
  try {
    await promise
    throw new Error('expected the call to fail')
  } catch (error) {
    return error as { code?: string; step?: string }
  }
}

/** `enterprise/` 这一层在不在（「零落盘」的判据：本面的一切落点都在它下面）。 */
async function enterpriseTreePresent(home: string): Promise<boolean> {
  try {
    await stat(join(home, 'enterprise'))
    return true
  } catch {
    return false
  }
}

/* ══════════════════════════ ① 取配置 ══════════════════════════ */

describe('取配置（真 HTTP 假平台 → 宿主内部读入口）', () => {
  it('把平台那份 mcpConfig.serverConfig 读成一条连接器事实，且只打一次平台并带着票据', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const before = official.installs.length
    const result = await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))

    expect(platform.countOf(DETAIL_PATH)).toBe(1)
    expect(platform.calls.find(call => call.path === DETAIL_PATH)?.ticket).toBe(TICKET)
    expect(official.installs).toHaveLength(before + 1)
    expect(result.disclosure).toEqual({
      mcpId: MCP_ID,
      name: '启信慧眼MCP',
      serverName: SERVER_NAME,
      url: DETAIL_URL,
      host: 'mcp.qixin.example',
      credentials: true,
    })
    // 落点也逐字锁住：`@local/dsent-connector-<id>` + `connector-<id>`。
    expect(result.packageName).toBe(`${CONNECTOR_BUNDLE_PACKAGE_PREFIX}${MCP_ID}`)
    expect(result.rowId).toBe(`connector-${MCP_ID}`)
    // 安装面拿到的 spec = **绝对包目录**（官方 `install_bundle` 的 target 口径）。
    expect(official.installs[0]?.spec).toBe(
      join(connectorBundleRoot({ dshHome: home }), MCP_ID, (await bundleDigests(home))[0] as string),
    )
  })

  it.each([
    ['serverConfig 不是 JSON', { mcpConfig: { serverConfig: 'definitely-not-json' } }],
    ['mcpServers 不是一个对象', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: [] }) } }],
    ['mcpServers 里没有那一条', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: {} }) } }],
    ['mcpServers 列了两条（我们无权挑一条）', {
      mcpConfig: {
        serverConfig: JSON.stringify({
          mcpServers: {
            [SERVER_NAME]: { url: DETAIL_URL },
            'another-server': { url: 'https://other.example/mcp' },
          },
        }),
      },
    }],
    ['url 不是 http(s)', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: 'ftp://mcp.qixin.example/mcp' } } }) } }],
    ['url 缺席', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: {} } }) } }],
    ['header 值不是字符串', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: DETAIL_URL, headers: { Authorization: 42 } } } }) } }],
    ['headers 不是对象', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: DETAIL_URL, headers: 'Bearer x' } } }) } }],
    ['header 名不是合法头名', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: DETAIL_URL, headers: { 'X Y': 'v' } } } }) } }],
    ['serverName 不合官方域', { mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { 'bad name!': { url: URL } } }) } }],
    ['mcpConfig 缺席', { mcpConfig: undefined }],
    ['平台回了另一条记录', { id: 135 }],
    ['行里没有可用的名字', { name: '' }],
  ])('%s ⇒ 明确失败且零落盘零安装', async (_label, overrides) => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow(overrides as Record<string, unknown>))
    const failure = await failCode(kernel.enable(MCP_ID, 'whatever'))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_CONFIG_INVALID')
    expect(official.installs).toHaveLength(0)
    expect(official.removes).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('详情行不是一个对象 ⇒ 明确失败且零落盘', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    platform.respond = path => platformLoginReply(path, TICKET)
      ?? (path === DETAIL_PATH ? platformEnvelope('not-a-row') : undefined)
    const failure = await failCode(kernel.enable(MCP_ID, 'whatever'))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_CONFIG_INVALID')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('信封不是信封（没有 code 那一格）⇒ 由**真实读入口**先判死，受控码原样上抛、零落盘', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    platform.respond = path => platformLoginReply(path, TICKET)
      ?? (path === DETAIL_PATH ? { body: { message: 'ok', data: connectorDetailRow() } } : undefined)
    const failure = await failCode(kernel.enable(MCP_ID, 'whatever'))
    // ★生产实现（`esc-route.ts` 的宿主内部读）在那一步就已经要求「带 code 的对象」；
    //   它交回的受控码**原样上抛**，本面不把它折成自己的形状码。
    expect(failure.code).toBe('ENT_NUWAX_PROTOCOL')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('信封闸门在**纯函数**那一层也是死的（给别的读实现留的那道）', () => {
    const failure = (() => {
      try {
        readConnectorPlatformConfig({ message: 'ok', data: connectorDetailRow() }, MCP_ID)
        throw new Error('expected the call to fail')
      } catch (error) {
        return error as { code?: string; step?: string }
      }
    })()
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_CONFIG_INVALID')
    expect(failure.step).toBe('envelope')
  })

  it('mcpId 形状不对 ⇒ 入口即止，一次平台都不打', async () => {
    const { platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const failure = await failCode(kernel.enable('../../etc/passwd'))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_INVALID_REQUEST')
    expect(platform.calls.filter(call => call.method === 'GET' && call.path.startsWith('/api/mcp/'))).toHaveLength(0)
    expect(official.installs).toHaveLength(0)
  })

  it('读面抛无码错 ⇒ 收敛成本面「这次没读到」那枚码（不是形状码）', async () => {
    const home = await connectorEnableTempHome()
    const official = createFakeOfficialManager()
    const kernel = createEnterpriseConnectorEnable({
      port: official.port,
      readPlatformJson: async () => { throw new Error('socket hang up') },
      dshHome: home,
    })
    const failure = await failCode(kernel.enable(MCP_ID, 'whatever'))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_CONFIG_UNAVAILABLE')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('读面抛**受控码**（没登录）⇒ 原样上抛，绝不折成「本机不可用」', async () => {
    const home = await connectorEnableTempHome()
    const official = createFakeOfficialManager()
    const kernel = createEnterpriseConnectorEnable({
      port: official.port,
      readPlatformJson: async () => {
        const error = new Error('no NUWAX session in this process') as Error & { code: string }
        error.code = 'ENT_AUTH_REQUIRED'
        throw error
      },
      dshHome: home,
    })
    const failure = await failCode(kernel.enable(MCP_ID, 'whatever'))
    expect(failure.code).toBe('ENT_AUTH_REQUIRED')
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('平台没给头 ⇒ 不要凭据：不写凭据文件、patch 里也没有 headers 那一行', async () => {
    const { home, platform, kernel } = await makeHarness()
    const row = connectorDetailRow({
      mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: DETAIL_URL } } }) },
    })
    serveDetail(platform, row)
    const result = await kernel.enable(MCP_ID, confirmFor(row))
    expect(result.disclosure.credentials).toBe(false)
    const { cordisPatch } = await readSynthesized(home)
    expect(cordisPatch).not.toContain('headers:')
    await expect(stat(connectorSecretPath({ dshHome: home }, MCP_ID))).rejects.toThrow()
  })
})

/* ══════════════════════════ ② 合成段 ══════════════════════════ */

describe('合成（配置型 bundle，恰好两个文件）', () => {
  it('package.json 就是冻结那三键', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const { dir, packageJson } = await readSynthesized(home)
    expect(packageJson).toBe(`${JSON.stringify({
      name: `${CONNECTOR_BUNDLE_PACKAGE_PREFIX}${MCP_ID}`,
      version: '1.0.0',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2)}\n`)
    expect((await readdir(dir)).sort()).toEqual(['cordis.patch.yml', 'package.json'])
  })

  it('★patch 逐字含 transport: streamable-http（反锁「只有 url+headers」那个形态）', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const { cordisPatch } = await readSynthesized(home)
    const secretPath = connectorSecretPath({ dshHome: home }, MCP_ID)
    const configLines = cordisPatch.split('\n').filter(line => line.startsWith('        ')).map(line => line)
    // ★整段 config 逐字锁住：serverName → **transport** → url → headers（`!!js`）→ failOnStartupError。
    //   把 transport 那一行删掉，这个数组立刻短一格（「只有 url+headers」的形态绝不允许存在）。
    expect(configLines).toEqual([
      `        serverName: ${SERVER_NAME}`,
      '        transport: streamable-http',
      `        url: ${DETAIL_URL}`,
      `        headers: !!js (() => JSON.parse(process.getBuiltinModule("node:fs").readFileSync(${JSON.stringify(secretPath)}, "utf8")).headers)()`,
      '        failOnStartupError: true',
    ])
    expect(cordisPatch).toBe([
      `# generated by dshent connector enable: one ${MCP_CLIENT_MODULE} row for connector ${MCP_ID}.`,
      '# 字段契约见 docs/plan/mcp-conformance.md §4；请勿手改（改 serverName = 改工具名，会作废会话历史与权限规则）。',
      '- insert:',
      `    - id: connector-${MCP_ID}`,
      `      name: '${MCP_CLIENT_MODULE}'`,
      '      config:',
      ...configLines,
      '',
    ].join('\n'))
  })

  it('★真 token 不进 patch：整份 patch 逐字 grep 不到它，只有那枚文件的绝对路径', async () => {
    const { home, platform, kernel } = await makeHarness()
    const row = connectorDetailRow()
    serveDetail(platform, row)
    await kernel.enable(MCP_ID, confirmFor(row))
    const { cordisPatch, packageJson } = await readSynthesized(home)
    // 先证平台真的把 token 交出来了（否则下面那几条「不含」是空断言）。
    const raw = await readFile(connectorSecretPath({ dshHome: home }, MCP_ID), 'utf8')
    expect(raw).toContain(`Bearer ${TOKEN}`)
    // 再证它**只**住在 0600 文件里：patch 文本逐字 grep 不到，连 `Bearer` 这个词都不该出现。
    expect(cordisPatch).not.toContain(TOKEN)
    expect(cordisPatch).not.toContain('Bearer')
    expect(packageJson).not.toContain(TOKEN)
    expect(cordisPatch).toContain(connectorSecretPath({ dshHome: home }, MCP_ID))
  })

  it('★那句 !!js 真的读得到那枚文件（按表达式求值，不是只看文本）', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const { cordisPatch } = await readSynthesized(home)
    const line = cordisPatch.split('\n').find(item => item.includes('headers: !!js'))
    expect(line).toBeDefined()
    const expression = (line as string).slice((line as string).indexOf('!!js ') + '!!js '.length)
    // 官方 loader 求的就是一个**表达式**（`new Function("ctx","expr","with(ctx){return eval(expr)}")`），
    // 故这里按同一个口径求值一次：只有它真的读得到那枚文件、且交回 headers 对象，这一条才算过。
    const evaluate = new Function(`return (${expression})`) as () => unknown
    expect(evaluate()).toEqual({ Authorization: `Bearer ${TOKEN}` })
  })

  it('配置真的变了 ⇒ 落到第二个摘要目录（「修同一个 bundle」，不覆盖旧的）', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const changed = connectorDetailRow({
      mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: `${DETAIL_URL}-v2` } } }) },
    })
    serveDetail(platform, changed)
    await kernel.enable(MCP_ID, confirmFor(changed))
    expect(await bundleDigests(home)).toHaveLength(2)
  })
})

/* ══════════════════════════ ③ 凭据落点 ══════════════════════════ */

describe('凭据落点（0o700 / 0o600 / 原子 / 无残留）', () => {
  it('目录 0o700、文件 0o600、正文是冻结三键、目录里没有 .tmp 残留', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const dir = join(home, 'enterprise', 'connector-secrets')
    const path = connectorSecretPath({ dshHome: home }, MCP_ID)
    expect((await stat(dir)).mode & 0o777).toBe(CONNECTOR_SECRET_DIR_MODE)
    expect((await stat(path)).mode & 0o777).toBe(CONNECTOR_SECRET_FILE_MODE)
    expect(await readdir(dir)).toEqual([`${MCP_ID}.json`])
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      mcpId: MCP_ID,
      serverName: SERVER_NAME,
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  })
})

/* ══════════════════════════ ④ 授权闸门 ══════════════════════════ */

describe('授权闸门（指纹 = 纯函数；不相等一律拒且零落盘零安装）', () => {
  it('从没确认过、也不交指纹 ⇒ REQUIRED，零落盘零安装', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const failure = await failCode(kernel.enable(MCP_ID))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_AUTHORIZATION_REQUIRED')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('交来的指纹不是当前披露那一枚 ⇒ STALE，零落盘零安装', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const wrong = createHash('sha256').update('someone-elses-disclosure').digest('hex')
    const failure = await failCode(kernel.enable(MCP_ID, wrong))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_AUTHORIZATION_STALE')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('指纹逐字相等 ⇒ 写授权（0o600 三键记录）并放行', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const fingerprint = confirmFor(connectorDetailRow())
    const result = await kernel.enable(MCP_ID, fingerprint)
    expect(result.fingerprint).toBe(fingerprint)
    expect(result.disclosure.host).toBe('mcp.qixin.example')
    const path = connectorAuthorizationPath({ dshHome: home })
    expect((await stat(join(home, 'enterprise', 'connector-authorizations'))).mode & 0o777).toBe(CONNECTOR_SECRET_DIR_MODE)
    expect((await stat(path)).mode & 0o777).toBe(CONNECTOR_SECRET_FILE_MODE)
    expect(await readConnectorAuthorizations({ dshHome: home })).toEqual([
      { mcpId: MCP_ID, fingerprint, authorizedAt: '2026-10-09T00:00:00.000Z' },
    ])
    // 原子写的临时件不许留痕。
    expect(await readdir(join(home, 'enterprise', 'connector-authorizations'))).toEqual([CONNECTOR_AUTHORIZATION_FILENAME])
  })

  it('授权过同一份披露 ⇒ 不交指纹也放行，但交来**另一枚**指纹照样拒', async () => {
    const { home, platform, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const fingerprint = confirmFor(connectorDetailRow())
    await kernel.enable(MCP_ID, fingerprint)
    const failure = await failCode(kernel.enable(MCP_ID, createHash('sha256').update('stale').digest('hex')))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_AUTHORIZATION_STALE')
    expect(await readConnectorAuthorizations({ dshHome: home })).toHaveLength(1)
  })

  it('披露变了（换了 url）⇒ 旧授权盖不住 ⇒ STALE；交来新指纹才过', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const changed = connectorDetailRow({
      mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: 'https://moved.qixin.example/mcp' } } }) },
    })
    serveDetail(platform, changed)
    const installsAfterFirst = official.installs.length
    const failure = await failCode(kernel.enable(MCP_ID))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_AUTHORIZATION_STALE')
    expect(official.installs).toHaveLength(installsAfterFirst)
    const fingerprint = confirmFor(changed)
    const result = await kernel.enable(MCP_ID, fingerprint)
    expect(result.fingerprint).toBe(fingerprint)
    expect((await readConnectorAuthorizations({ dshHome: home }))[0]?.fingerprint).toBe(fingerprint)
  })

  it('指纹只吃披露、不吃凭据值：平台轮换 token 不改指纹', async () => {
    const { platform, kernel, official } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const fingerprint = confirmFor(connectorDetailRow())
    await kernel.enable(MCP_ID, fingerprint)
    const rotated = connectorDetailRow({
      mcpConfig: {
        serverConfig: JSON.stringify({
          mcpServers: { [SERVER_NAME]: { url: DETAIL_URL, headers: { Authorization: 'Bearer rotated-token' } } },
        }),
      },
    })
    serveDetail(platform, rotated)
    expect(confirmFor(rotated)).toBe(fingerprint)
    // 不交指纹也过闸门（同一份披露）；但凭据变了 ⇒ **要**让官方重挂一次，让新 token 真正生效。
    const before = official.installs.length
    const result = await kernel.enable(MCP_ID)
    expect(result.fingerprint).toBe(fingerprint)
    expect(official.installs).toHaveLength(before + 1)
  })

  it('授权状态文件损坏 ⇒ fail-closed（绝不当成空清单覆盖）', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const path = connectorAuthorizationPath({ dshHome: home })
    await mkdir(join(home, 'enterprise', 'connector-authorizations'), { recursive: true, mode: 0o700 })
    await writeFile(path, '{ definitely not json', 'utf8')
    const failure = await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow())))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_STATE_INVALID')
    expect(official.installs).toHaveLength(0)
    expect(await readFile(path, 'utf8')).toBe('{ definitely not json')
  })
})

/* ══════════════════════════ ⑤ 幂等 ══════════════════════════ */

describe('幂等（同一 mcpId 再启用 ⇒ 如实结果，不重复装）', () => {
  it('第二次启用不再调官方安装面，且结果如实带 alreadyInstalled', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    const fingerprint = confirmFor(connectorDetailRow())
    const first = await kernel.enable(MCP_ID, fingerprint)
    expect(first.alreadyInstalled).toBe(false)
    const second = await kernel.enable(MCP_ID)
    expect(second.alreadyInstalled).toBe(true)
    expect(second.officialApplication).toBe('applied')
    expect(second.connection.connected).toBe(true)
    expect(official.installs).toHaveLength(1)
    expect(await bundleDigests(home)).toHaveLength(1)
  })

  it('官方说装着但**没启用** ⇒ 不算已连接，重新走一次安装面把它启用', async () => {
    const { platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    official.bundles = [{ name: connectorBundlePackageName(MCP_ID), installed: true, enabled: false }]
    const result = await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    expect(result.alreadyInstalled).toBe(false)
    expect(official.installs).toHaveLength(1)
  })

  it('connection() 只读官方状态：装着且启用 ⇒ connected；装着没启用 ⇒ 不算', async () => {
    const { official, kernel } = await makeHarness()
    official.bundles = [{ name: connectorBundlePackageName(MCP_ID), installed: true, enabled: false }]
    expect(await kernel.connection(MCP_ID)).toEqual({
      mcpId: MCP_ID,
      packageName: connectorBundlePackageName(MCP_ID),
      installed: true,
      enabled: false,
      connected: false,
    })
    official.bundles = [{ name: connectorBundlePackageName(MCP_ID), installed: true, enabled: true }]
    expect((await kernel.connection(MCP_ID)).connected).toBe(true)
    official.bundles = []
    expect((await kernel.connection(MCP_ID)).installed).toBe(false)
  })
})

/* ══════════════════════════ ⑥ 装卸 ══════════════════════════ */

describe('装卸（唯一安装面 = 官方）', () => {
  it('装：spec 是绝对包目录；失败 ⇒ 稳定码，不降级出第二条安装通道', async () => {
    const { platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    expect(official.installs[0]?.options).toEqual({ enabled: true })

    official.installError = new Error('pnpm failed')
    const failed = connectorDetailRow({
      mcpConfig: { serverConfig: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url: 'https://second.example/mcp' } } }) },
    })
    serveDetail(platform, failed)
    const failure = await failCode(kernel.enable(MCP_ID, confirmFor(failed)))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_INSTALL_FAILED')
    // ★官方抛错时**不**另找一条通道：再也没有任何别的写动作被记录（安装次数就那么多）。
    expect(official.installs).toHaveLength(2)
  })

  it('官方回 failed / cancelled ⇒ 两枚不同的稳定码', async () => {
    const { platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    official.installResult = { target: 'x', changed: false, application: 'failed' }
    expect((await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow())))).code)
      .toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_INSTALL_FAILED')
    official.installResult = { target: 'x', changed: false, application: 'cancelled' }
    expect((await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))))).toMatchObject({
      code: 'ENT_CONNECTOR_INSTALL_CANCELLED',
    })
  })

  it('卸：官方 removeBundle 用 bundle 名 + 删掉那枚凭据文件', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    const result = await kernel.disable(MCP_ID)
    expect(official.removes).toEqual([connectorBundlePackageName(MCP_ID)])
    expect(result).toMatchObject({ ok: true, removed: true, alreadyAbsent: false, secretRemoved: true })
    expect(await readdir(join(home, 'enterprise', 'connector-secrets'))).toEqual([])
    // 授权记录**不**因断开而消失：同一份披露再启用不该重新打扰员工。
    expect(await readConnectorAuthorizations({ dshHome: home })).toHaveLength(1)
  })

  it('卸一个从没装过的 ⇒ 如实成功（不记账 ⇒ 「没装过」与「卸干净了」不可区分）', async () => {
    const { home, official, kernel } = await makeHarness()
    const result = await kernel.disable(MCP_ID)
    expect(official.removes).toHaveLength(0)
    expect(result).toMatchObject({ ok: true, removed: false, alreadyAbsent: true, secretRemoved: false })
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('官方没卸掉（回 failed）⇒ 抛，且**不删**凭据（那条行还挂着、还在用它）', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    official.removeResult = { target: 'x', changed: false, application: 'failed' }
    const failure = await failCode(kernel.disable(MCP_ID))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_UNINSTALL_FAILED')
    expect(await readdir(join(home, 'enterprise', 'connector-secrets'))).toEqual([`${MCP_ID}.json`])
  })

  it('★凭据删不掉 ⇒ 抛（不许静默留「已断开但凭据还在」）', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    await kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    // 把那份凭据换成**非空目录**：`rm(file, { force: false })` 必然失败（与进程身份无关的确定性反例）。
    const path = connectorSecretPath({ dshHome: home }, MCP_ID)
    await rm(path, { force: true })
    await mkdir(path, { recursive: true, mode: 0o700 })
    await writeFile(join(path, 'occupied'), 'x', 'utf8')
    const failure = await failCode(kernel.disable(MCP_ID))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_UNINSTALL_FAILED')
    expect(failure.step).toBe('secret-delete')
    expect(official.removes).toEqual([connectorBundlePackageName(MCP_ID)])
    expect(await readdir(path)).toEqual(['occupied'])
  })

  it('删除凭据时用的是**非递归** rm：符号链接不跟随、目录不整棵删', async () => {
    const { home, kernel } = await makeHarness()
    const outside = join(home, 'outside.json')
    await writeFile(outside, 'do-not-touch', 'utf8')
    await mkdir(join(home, 'enterprise', 'connector-secrets'), { recursive: true, mode: 0o700 })
    await symlink(outside, connectorSecretPath({ dshHome: home }, MCP_ID))
    const result = await kernel.disable(MCP_ID)
    expect(result.secretRemoved).toBe(true)
    expect(await readFile(outside, 'utf8')).toBe('do-not-touch')
  })

  it('并发：同一个 mcpId 正在装时再点 ⇒ 拒绝而不排队', async () => {
    const { platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    let release = (): void => undefined
    official.installGate = new Promise<void>(resolve => { release = resolve })
    const first = kernel.enable(MCP_ID, confirmFor(connectorDetailRow()))
    await vi.waitFor(() => { expect(kernel.busy(MCP_ID)).toBe(true) })
    const failure = await failCode(kernel.enable(MCP_ID))
    expect(failure.code).toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_INSTALL_IN_PROGRESS')
    release()
    await first
    expect(official.installs).toHaveLength(1)
  })
})

/* ══════════════════════════ ⑦ 官方管理面 fail-closed ══════════════════════════ */

describe('官方管理面（缺席/形状不对 ⇒ fail-closed，不装）', () => {
  it('ctx 里没有 pluginManager / 只有两个方法 / 方法不是函数 ⇒ 一律 undefined', () => {
    expect(connectorEnablePortFromContext({ get: () => undefined })).toBeUndefined()
    expect(connectorEnablePortFromContext({
      get: () => ({ installBundle: () => undefined, removeBundle: () => undefined }),
    })).toBeUndefined()
    expect(connectorEnablePortFromContext({
      get: () => ({ installBundle: () => undefined, removeBundle: () => undefined, listBundles: 'nope' }),
    })).toBeUndefined()
    expect(isConnectorEnableManager(null)).toBe(false)
    expect(isConnectorEnableManager({})).toBe(false)
  })

  it('三个方法都在 ⇒ 端口可用（且原样投影官方结果、不吞异常）', async () => {
    const official = createFakeOfficialManager()
    const port = connectorEnablePortFromContext({ get: () => official.manager }) as ConnectorEnablePort
    expect(port).toBeDefined()
    expect(await port.listBundles()).toEqual([])
    const home = await connectorEnableTempHome()
    // 一个**不是** bundle 的目录：官方那侧抛，端口**原样**把它抛出去（绝不折成 failed 这种"看起来装过了"）。
    await mkdir(home, { recursive: true })
    await writeFile(join(home, 'package.json'), JSON.stringify({ name: 'not-a-bundle' }), 'utf8')
    await expect(port.installBundle(home)).rejects.toThrow()
  })

  it('listBundles 回非数组 / 回一条畸形行 ⇒ STATE_INVALID（绝不把它当「一条都没装」）', async () => {
    const { home, platform, official, kernel } = await makeHarness()
    serveDetail(platform, connectorDetailRow())
    official.listResult = { records: [] }
    expect((await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow())))).code)
      .toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_STATE_INVALID')
    official.listResult = [{ name: 'ok', installed: true, enabled: true }, null]
    expect((await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow())))).code)
      .toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_STATE_INVALID')
    official.listResult = undefined
    official.listError = new Error('official read blew up')
    expect((await failCode(kernel.enable(MCP_ID, confirmFor(connectorDetailRow())))).code)
      .toBe<EnterpriseConnectorEnableErrorCode>('ENT_CONNECTOR_STATE_INVALID')
    expect(official.installs).toHaveLength(0)
    expect(await enterpriseTreePresent(home)).toBe(false)
  })

  it('投影只认三格，其余字段一律不进结果', () => {
    expect(projectOfficialBundleSummaries([
      { name: 'a', installed: true, enabled: true, version: '9.9.9', rows: [{ rowId: 'x' }] },
      { name: 'b', installed: 1, enabled: 'yes' },
    ])).toEqual([
      { name: 'a', installed: true, enabled: true },
      { name: 'b', installed: false, enabled: false },
    ])
  })
})

/* ══════════════════════════ ⑧ 源码级 ══════════════════════════ */

describe('源码级（本面不许有第二套安装/运行机制）', () => {
  it('无 exec / spawn / 动态 import / require / eval；不写 profile 任何文件', async () => {
    const raw = await readFile(new URL('../src/connector-enable.ts', import.meta.url), 'utf8')
    // ★只在**剥掉注释**之后判：本文件的注释里刻意引用了官方求值器那行源码（`eval(expr)`）与
    //   「不 import 官方包」这类话，那些是**文档**，不是本面在做的事。
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(source).not.toMatch(/\bexec(?:File|FileSync|Sync)?\b/)
    expect(source).not.toMatch(/\bspawn\b/)
    expect(source).not.toMatch(/\bchild_process\b/)
    expect(source).not.toMatch(/\bimport\s*\(/)
    expect(source).not.toMatch(/(?:^|[^.\w])require\s*\(/m)
    expect(source).not.toMatch(/\beval\s*\(/)
    expect(source).not.toMatch(/profileContext/)
    expect(source).not.toMatch(/['"`][^'"`]*\/profiles\//)
    // `cordis.patch.yml` 只出现在「我们合成的那份」语境里：剥掉注释后**恰好四处**，
    // 且每一处都是那个冻结文件名本身的四种正当用法（文件名表 / patch 相对路径 / 暂存写 / 读回）。
    // 谁要往别处（比如 profile 的 patch）引它，这条会立刻红。
    const patchMentions = source.split('\n').filter(line => line.includes('cordis.patch.yml'))
    expect(patchMentions).toHaveLength(4)
    for (const line of patchMentions) {
      expect(line).not.toContain('profile')
      expect(line).toMatch(/'cordis\.patch\.yml'|'\.\/cordis\.patch\.yml'/)
      expect(line).toMatch(/CONNECTOR_BUNDLE_FILENAMES|patch: '\.\/cordis\.patch\.yml'|join\(staging, 'cordis\.patch\.yml'\)|join\(dir, 'cordis\.patch\.yml'\)/)
    }
  })

  it('源码里的传输常量就是官方那一枚（不许是 sse / stdio）', async () => {
    const source = await readFile(new URL('../src/connector-enable.ts', import.meta.url), 'utf8')
    expect(source).toContain("export const CONNECTOR_TRANSPORT = 'streamable-http'")
    expect(source).not.toMatch(/CONNECTOR_TRANSPORT = '(?:sse|stdio)'/)
  })

  it('技能族的码边界一字不改：新码只在本面（连接器启用那枚文件里）', async () => {
    const source = await readFile(new URL('../src/connector-enable.ts', import.meta.url), 'utf8')
    for (const code of [
      'ENT_CONNECTOR_AUTHORIZATION_REQUIRED',
      'ENT_CONNECTOR_AUTHORIZATION_STALE',
      'ENT_CONNECTOR_CONFIG_UNAVAILABLE',
      'ENT_CONNECTOR_CONFIG_INVALID',
      'ENT_CONNECTOR_LOCAL_WRITE_FAILED',
      'ENT_CONNECTOR_INSTALL_FAILED',
      'ENT_CONNECTOR_INSTALL_CANCELLED',
      'ENT_CONNECTOR_INSTALL_IN_PROGRESS',
      'ENT_CONNECTOR_UNINSTALL_FAILED',
      'ENT_CONNECTOR_STATE_INVALID',
    ]) {
      expect(source).toContain(`'${code}'`)
    }
    const skillErrors = await readFile(new URL('../src/skill-errors.ts', import.meta.url), 'utf8')
    expect(skillErrors).not.toContain('ENT_CONNECTOR_')
  })

  it('本面自己的失败类型带稳定码 + 只进日志的 step', () => {
    const error = new EnterpriseConnectorEnableError('ENT_CONNECTOR_INSTALL_FAILED', 'boom', 'install', new Error('cause'))
    expect(error.code).toBe('ENT_CONNECTOR_INSTALL_FAILED')
    expect(error.step).toBe('install')
    expect(error.name).toBe('EnterpriseConnectorEnableError')
    expect((error as { cause?: unknown }).cause).toBeInstanceOf(Error)
  })

  it('落点助手是纯函数：目录与文件名逐字', () => {
    const options = { dshHome: '/tmp/h' }
    expect(connectorBundlePackageName(MCP_ID)).toBe(`@local/dsent-connector-${MCP_ID}`)
    expect(connectorBundleDirectory(options, MCP_ID, 'a'.repeat(64)))
      .toBe(join('/tmp/h', 'enterprise', 'connector-bundles', MCP_ID, 'a'.repeat(64)))
    expect(connectorSecretPath(options, MCP_ID)).toBe(join('/tmp/h', 'enterprise', 'connector-secrets', `${MCP_ID}.json`))
    expect(connectorAuthorizationPath(options))
      .toBe(join('/tmp/h', 'enterprise', 'connector-authorizations', CONNECTOR_AUTHORIZATION_FILENAME))
    expect(() => connectorBundlePackageName('../x')).toThrow(EnterpriseConnectorEnableError)
  })
})
