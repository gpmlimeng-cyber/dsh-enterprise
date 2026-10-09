/**
 * [INPUT]: 依赖内核（`./connector-enable.js`：`createEnterpriseConnectorEnable` 的四段实现、`readEnterpriseConnectorDisclosure` / `readConnectorOfficialBundles` / `connectorConnectionFrom` 三个共用出口、`CONNECTOR_BUNDLE_PACKAGE_PREFIX` / `CONNECTOR_MCP_ID_PATTERN` 两枚形状常量与 `EnterpriseConnectorEnableError` 码边界）
 * [OUTPUT]: 对外提供本机 HTTP 面**唯一**的脱敏投影层——三个纯函数 `stripConnectorUrlCredentials`（URL 去凭据）/ `projectConnectorConnection` / `projectConnectorDisclosure`、两个结果投影 `projectConnectorEnableResult` / `projectConnectorDisableResult`、出厂形状常量（`ENTERPRISE_CONNECTOR_CONNECTION_KEYS` / `_DISCLOSURE_KEYS` / `_STATUS_KEYS` / `_ENABLE_KEYS` / `_DISABLE_KEYS` / `_CONNECTED_KEYS`）与 `createEnterpriseConnectorEnableService`（`status` / `enable` / `disable` / `connected` 四个端口）
 * [POS]: bundle 连接器纵深的**宿主接线层 + 出 host 的脱敏闸门**（与 `preset-service.ts` 在配方纵深里的位置逐字对应）：
 *   内核在左、`connector-enable-route.ts` 在右，所有"交到浏览器的那几个键集"只由本文件决定。
 *
 *   ### ★为什么脱敏投影只此一处
 *   内核的 `ConnectorConnection` / `ConnectorEnableDisclosure` 是**宿主侧**的事实（`mcpId` 是字符串、
 *   披露里的 `url` 是平台原文）；出厂契约是**另一套形状**（`mcpId` 是数字、`url` 已去凭据、键集关闭）。
 *   若让路由自己拼一遍、另一个调用方再拼一遍，"哪几个键出厂"就会有两处真相——一处加了 `secretPath`
 *   这种排障字段，凭据面就漏进浏览器。故本文件是**从零构造**（不是"删掉危险键"）：出厂字面量里没有
 *   的位置，任何输入下都不可能漏出去；路由那层只做形状门禁与分派，一个响应键都不自己拼。
 *
 *   ### ★为什么 `url` 必须去凭据
 *   平台那份 `mcpConfig.serverConfig` 是**可直接落地的客户端配置**，真机取证里 URL 内嵌凭据是它的一种
 *   合法形态（`https://u:p@host/`）。而本机路由是同源 HTTP 面：内嵌凭据一旦出厂就等于把凭据发给前端
 *   （浏览器还会把它写进 devtools、历史、错误上报）。故出厂前**逐字**走 `new URL()` 的
 *   username/password 清空那一步；无凭据的 URL **原样**出厂（绝不顺手做规范化——那会让界面看到的
 *   地址与平台那条记录不一致）；解不出来的 URL ⇒ **明确失败**（绝不猜、也绝不原样放行）。
 *   指纹仍然是**未去凭据那份披露**的指纹（内核算的），本文件一个字节都不重算：去凭据是**出厂形状**
 *   的事，不是"换了一份披露"。
 *
 *   ### ★结果对象是内核的实现面，出厂形状才是契约面
 *   `projectConnectorEnableResult` / `projectConnectorDisableResult` 对**要用到的每一格**逐格收窄
 *   （畸形/缺席 ⇒ 明确失败，绝不 `as`、绝不补默认），但**不**要求内核那份结果对象的键集恰好——它随内核
 *   生长（`rowId`/`serverName`/`officialApplication`… 都是内核的事），把契约钉在内核的实现面上会让下一次
 *   内核改动无谓地打红。**出厂**的两个形状则是关闭键集（`ENTERPRISE_CONNECTOR_*_KEYS`），那才是契约面。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  CONNECTOR_BUNDLE_PACKAGE_PREFIX,
  CONNECTOR_MCP_ID_PATTERN,
  EnterpriseConnectorEnableError,
  connectorConnectionFrom,
  createEnterpriseConnectorEnable,
  readConnectorOfficialBundles,
  readEnterpriseConnectorDisclosure,
  type ConnectorEnablePort,
} from './connector-enable.js'

/* ══════════════════════════ 出厂形状（关闭键集，逐字冻结契约） ══════════════════════════ */

/**
 * 一条出厂连接器的**必填**安全格；顺序即响应里的键序（用例按这个清单做逐键集合断言）。
 *
 * ★这里没有、也永远不会有：`secretPath` / `headers` / `rowId` / `serverName` / `bundleDir` /
 *   任何宿主绝对路径 / patch 文本 / `application` 那类官方自由文本。
 */
export const ENTERPRISE_CONNECTOR_CONNECTION_KEYS = [
  'mcpId',
  'packageName',
  'installed',
  'enabled',
  'connected',
] as const

/** 披露的**必填**安全格：弹层要逐项列出的东西，`url` 已去内嵌凭据。 */
export const ENTERPRISE_CONNECTOR_DISCLOSURE_KEYS = [
  'mcpId',
  'name',
  'serverName',
  'host',
  'url',
  'credentials',
] as const

/** `GET <local>/connectors/<mcpId>/status` 的 200 响应体（关闭键集）。 */
export const ENTERPRISE_CONNECTOR_STATUS_KEYS = ['disclosure', 'fingerprint', 'connection'] as const

/** `POST <local>/connectors/enable` 的 200 响应体（关闭键集）。 */
export const ENTERPRISE_CONNECTOR_ENABLE_KEYS = ['connection', 'fingerprint', 'alreadyInstalled'] as const

/** `POST <local>/connectors/disable` 的 200 响应体（关闭键集）。 */
export const ENTERPRISE_CONNECTOR_DISABLE_KEYS = ['connection', 'alreadyAbsent'] as const

/** `GET <local>/connectors/connected` 的 200 响应体（关闭键集）。 */
export const ENTERPRISE_CONNECTOR_CONNECTED_KEYS = ['connected', 'complete'] as const

/** 出厂的一条连接器（浏览器侧解码器收的就是这个形状）。 */
export interface EnterpriseConnectorConnection {
  readonly mcpId: number
  readonly packageName: string
  readonly installed: boolean
  readonly enabled: boolean
  readonly connected: boolean
}

/** 出厂的披露（`url` 已去内嵌凭据；`host` 与指纹仍来自未去凭据那份披露）。 */
export interface EnterpriseConnectorDisclosure {
  readonly mcpId: number
  readonly name: string
  readonly serverName: string
  readonly host: string
  readonly url: string
  readonly credentials: boolean
}

/** `status` 端口的出厂视图。 */
export interface EnterpriseConnectorStatusView {
  readonly disclosure: EnterpriseConnectorDisclosure
  readonly fingerprint: string
  readonly connection: EnterpriseConnectorConnection
}

/** `enable` 端口的出厂视图。 */
export interface EnterpriseConnectorEnableView {
  readonly connection: EnterpriseConnectorConnection
  readonly fingerprint: string
  /** `true` = 本来就已经装好且配置逐字相同，**这次没有调官方安装面**。 */
  readonly alreadyInstalled: boolean
}

/** `disable` 端口的出厂视图。 */
export interface EnterpriseConnectorDisableView {
  readonly connection: EnterpriseConnectorConnection
  /** `true` = 官方说它本来就没装着（「从没装过」与「已经卸干净」在本机不可区分）。 */
  readonly alreadyAbsent: boolean
}

/** `connected` 端口的出厂视图（`complete:false` = 官方清单里有本族但形状不对的行，如实说出这件事）。 */
export interface EnterpriseConnectorConnectionsView {
  readonly connected: readonly EnterpriseConnectorConnection[]
  readonly complete: boolean
}

/* ══════════════════════════ 纯函数投影（唯一一处决定出厂键集） ══════════════════════════ */

/** 只认真对象（数组与 null 都不算）。 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * 投影这一层看到的内核输出读不懂。
 *
 * ★用内核码边界里**已存在**的那一枚（`ENT_CONNECTOR_STATE_INVALID`：「本机状态读不懂」）：
 *   它的下一步与内核自己读到坏状态时**完全相同**（本机这块先别动、让人去看），而请求本身是合法的
 *   ⇒ 绝不是 `ENT_INVALID_REQUEST`（那会把"我们自己交出来的东西不对"说成"你请求写得不对"）。
 * ★本函数**不新增**任何码：本面的码边界仍只在内核文件里（那一枚的定义处就在 `connector-enable.ts`）。
 */
function projectionInvalid(message: string, cause?: unknown): EnterpriseConnectorEnableError {
  return new EnterpriseConnectorEnableError(
    'ENT_CONNECTOR_STATE_INVALID',
    message,
    'config',
    cause,
  )
}

/** 关闭键集门禁（逐键、与出厂清单比集合）：多一格少一格都**明确失败**，绝不静默丢。 */
function requireExactKeys(
  row: Record<string, unknown>,
  keys: readonly string[],
  what: string,
): void {
  if (Object.keys(row).sort().join(',') !== [...keys].sort().join(',')) {
    throw projectionInvalid(`the kernel answered a ${what} whose key set is not the frozen one`)
  }
}

/** 逐格收窄一个非空字符串。 */
function requireNonEmptyString(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw projectionInvalid(`the kernel answered a ${what} that is not a non-empty string`)
  }
  return value
}

/** 逐格收窄一个布尔（**不做真值性转换**：不是 `true`/`false` 就明确失败）。 */
function requireBoolean(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') {
    throw projectionInvalid(`the kernel answered a ${what} that is not a boolean`)
  }
  return value
}

/** 取一枚**结果对象**（内核的实现面：只认"是个对象"，键集不钉）。 */
function requireResultRecord(value: unknown, what: string): Record<string, unknown> {
  const row = asRecord(value)
  if (row === undefined) throw projectionInvalid(`the kernel answered a ${what} that is not an object`)
  return row
}

/**
 * 十进制 `mcpId`（内核那枚字符串）→ 响应里的**安全整数**。
 *
 * ★形状判据用的是内核**导出**的那枚 `CONNECTOR_MCP_ID_PATTERN`（不在这里另写一把尺）；之后
 *   **必须**真的落进 `Number` 的安全整数域：18 位十进制可以超过 `2^53-1`，那种 id 发出去就已经丢精度
 *   ⇒ 明确失败，绝不发一个看起来对、实际已经变的数字（也绝不悄悄退回字符串——契约冻结了 `<number>`）。
 */
function requireViewMcpId(value: unknown, what: string): number {
  if (typeof value !== 'string' || !CONNECTOR_MCP_ID_PATTERN.test(value)) {
    throw projectionInvalid(`the kernel answered a ${what} whose mcpId is not the platform decimal id`)
  }
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw projectionInvalid(`the kernel answered a ${what} whose mcpId is outside the safe integer domain`)
  }
  return id
}

/**
 * **纯函数**：URL 的**内嵌凭据**摘掉（出厂那一步）。
 *
 * `https://u:p@h/x` ⇒ `https://h/x`；`https://u@h/x` ⇒ `https://h/x`；
 * ★**无凭据的 URL 逐字原样**（`https://h/x` ⇒ `https://h/x`，绝不走 `new URL().toString()`
 * 那条会顺手把 `https://h` 变成 `https://h/` 的规范化路）；★解不出来 / 不是 http(s) / 没有
 * 可解析的 host ⇒ 明确失败（**绝不原样放行**：那等于"读不懂就当它没有凭据"）。
 *
 * @param url - 内核披露里那枚 `url`（平台原文）。
 * @returns 去凭据后的 URL（无凭据时与入参**逐字相同**）。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`。
 */
export function stripConnectorUrlCredentials(url: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw projectionInvalid('the connector url is not a non-empty string')
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (error) {
    throw projectionInvalid('the connector url could not be parsed', error)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw projectionInvalid('the connector url must be an http(s) URL')
  }
  if (parsed.host.length === 0) {
    throw projectionInvalid('the connector url has no host')
  }
  if (parsed.username === '' && parsed.password === '') return url
  parsed.username = ''
  parsed.password = ''
  return parsed.toString()
}

/**
 * 内核那枚连接事实 → **出厂**连接器（纯函数；逐格收窄 + 关闭键集）。
 *
 * @param value - 内核的 `ConnectorConnection`（本文件不信任它的形状，逐格复核）。
 * @returns 出厂连接器。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`（畸形/缺席）。
 */
export function projectConnectorConnection(value: unknown): EnterpriseConnectorConnection {
  const row = asRecord(value)
  if (row === undefined) throw projectionInvalid('the kernel answered a connection that is not an object')
  requireExactKeys(row, ENTERPRISE_CONNECTOR_CONNECTION_KEYS, 'connection')
  return {
    mcpId: requireViewMcpId(row['mcpId'], 'connection'),
    // ★`packageName` **逐字**用内核那一枚（官方安装面的包名，不含凭据）：校验形状后原样出厂，不自己拼。
    packageName: requireNonEmptyString(row['packageName'], 'packageName'),
    installed: requireBoolean(row['installed'], 'installed'),
    enabled: requireBoolean(row['enabled'], 'enabled'),
    connected: requireBoolean(row['connected'], 'connected'),
  }
}

/**
 * 内核那枚披露 → **出厂**披露（纯函数；`url` 去内嵌凭据）。
 *
 * ★`host` 与指纹都来自**未去凭据**那份披露（内核算的）：换域等于换了一台服务器，这件事与"URL 里写没写
 *   凭据"无关；去凭据只改**出厂形状**这一格。
 *
 * @param value - 内核的 `ConnectorEnableDisclosure`。
 * @returns 出厂披露。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`（畸形/缺席/URL 解不出）。
 */
export function projectConnectorDisclosure(value: unknown): EnterpriseConnectorDisclosure {
  const row = asRecord(value)
  if (row === undefined) throw projectionInvalid('the kernel answered a disclosure that is not an object')
  requireExactKeys(row, ENTERPRISE_CONNECTOR_DISCLOSURE_KEYS, 'disclosure')
  const url = requireNonEmptyString(row['url'], 'disclosure url')
  return {
    mcpId: requireViewMcpId(row['mcpId'], 'disclosure'),
    name: requireNonEmptyString(row['name'], 'disclosure name'),
    serverName: requireNonEmptyString(row['serverName'], 'disclosure serverName'),
    host: requireNonEmptyString(row['host'], 'disclosure host'),
    url: stripConnectorUrlCredentials(url),
    credentials: requireBoolean(row['credentials'], 'disclosure credentials'),
  }
}

/** 指纹：契约只要求 `<string>`，形状（sha256 hex）由内核定义 ⇒ 这里只收窄到非空字符串，不另写一把尺。 */
function requireFingerprint(value: unknown, what: string): string {
  return requireNonEmptyString(value, `${what} fingerprint`)
}

/**
 * 内核的启用结果 → 出厂视图（纯函数；只用得到的四格，畸形/缺席 ⇒ 明确失败）。
 *
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`。
 */
export function projectConnectorEnableResult(value: unknown): EnterpriseConnectorEnableView {
  const row = requireResultRecord(value, 'enable result')
  return {
    connection: projectConnectorConnection(row['connection']),
    fingerprint: requireFingerprint(row['fingerprint'], 'enable result'),
    alreadyInstalled: requireBoolean(row['alreadyInstalled'], 'enable result alreadyInstalled'),
  }
}

/**
 * 内核的断开结果 → 出厂视图（纯函数；`alreadyAbsent` 原样，**不**用本机的第二本账去反推）。
 *
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`。
 */
export function projectConnectorDisableResult(value: unknown): EnterpriseConnectorDisableView {
  const row = requireResultRecord(value, 'disable result')
  return {
    connection: projectConnectorConnection(row['connection']),
    alreadyAbsent: requireBoolean(row['alreadyAbsent'], 'disable result alreadyAbsent'),
  }
}

/**
 * **纯函数**：官方清单 → 「已连接的」那一格。
 *
 * 判定逐条（每条都是刻意的）：
 *  ① 包名**不以** {@link CONNECTOR_BUNDLE_PACKAGE_PREFIX} 开头 ⇒ **不是本族**，与本面无关（不计入、
 *     也不影响 `complete` —— 那份 profile 里别人的 bundle 不是我们的漏报）；
 *  ② 是本族但前缀之后**不是**合法十进制 id ⇒ 该条**不入列** + `dropped` 计数（由调用方经 `onError`
 *     留 `step=connected-shape` 并把 `complete:false` 如实出厂）；**绝不猜**一个 id、也绝不折成"没连接"
 *     ——那是谎称"这台机器上没有这条连接"；
 *  ③ 其余走内核那枚**唯一**的纯判据 {@link connectorConnectionFrom}（`connected = installed && enabled`），
 *     故本函数**不重写**任何连接语义；
 *  ④ 只收 `installed === true` 的（"已连接的"那一格列的是装上的行；装了但没启用的照样在列，`connected:false`）。
 *
 * @param bundles - 官方清单（每行已由端口投影成 `{name, installed, enabled}`）。
 * @returns 出厂连接器清单（本族且已装的那些）与**本族形状不对**的条数。
 * @throws {EnterpriseConnectorEnableError} `ENT_CONNECTOR_STATE_INVALID`（本族某条的内核判据读不懂）。
 */
export function projectConnectorConnections(bundles: readonly unknown[]): {
  readonly connections: readonly EnterpriseConnectorConnection[]
  readonly dropped: number
} {
  const connections: EnterpriseConnectorConnection[] = []
  let dropped = 0
  for (const item of bundles) {
    const row = asRecord(item)
    const name = row === undefined ? undefined : row['name']
    if (typeof name !== 'string' || !name.startsWith(CONNECTOR_BUNDLE_PACKAGE_PREFIX)) continue
    const id = name.slice(CONNECTOR_BUNDLE_PACKAGE_PREFIX.length)
    if (!CONNECTOR_MCP_ID_PATTERN.test(id)) {
      dropped += 1
      continue
    }
    const connection = connectorConnectionFrom(id, {
      name,
      installed: row?.['installed'] === true,
      enabled: row?.['enabled'] === true,
    })
    if (connection.installed) connections.push(projectConnectorConnection(connection))
  }
  return { connections, dropped }
}

/* ══════════════════════════ 四个端口（路由只分派，判定全在左右两侧） ══════════════════════════ */

/** 四个本机路由端口；`connector-enable-route.ts` 只做转发与状态码投影，不做任何语义判断。 */
export interface EnterpriseConnectorEnableService {
  status(mcpId: string): Promise<EnterpriseConnectorStatusView>
  enable(mcpId: string, confirmFingerprint?: string): Promise<EnterpriseConnectorEnableView>
  disable(mcpId: string): Promise<EnterpriseConnectorDisableView>
  connected(): Promise<EnterpriseConnectorConnectionsView>
}

export interface EnterpriseConnectorEnableServiceOptions {
  /**
   * 官方管理面的**每次调用现场解引用**口（生产 = `connectorEnablePortFromContext(ctx)`）。
   *
   * ★为什么是函数而不是端口本身：官方 plugin-manager 与本插件在同一棵 loader 树里**并发 create**，
   *   `apply()` 那一刻它通常还没 provide；把判决快照进对象，服务后来就绪也进不了路由。
   * ★官方服务缺席 / 形状不对 ⇒ 回 `undefined`，本面**明确失败**（见 {@link unavailableConnectorEnablePort}），
   *   **绝不**降级出第二条安装通道、绝不假装"没装过"。
   */
  readonly port: () => ConnectorEnablePort | undefined
  /** 平台取数（生产 = **同一个** `escReadPort` 的宿主内部读面 `readEnterpriseEscHostJson`）。 */
  readonly readPlatformJson: (path: string) => Promise<unknown>
  /** 落点覆盖（测试用；生产不传 ⇒ 内核按 `resolveEnterpriseDshHome()` 决议）。 */
  readonly dshHome?: string
  /** 授权时间源（测试用；生产不传 ⇒ 内核用 `new Date()`）。 */
  readonly now?: () => Date
  /** 判定点留痕（内核的平台读失败、本面的形状丢弃）；组合层接到 Host logger。 */
  readonly onError?: (message: string, error: unknown) => void
}

/**
 * 官方管理面缺席时抛出的**唯一**形态。
 *
 * ★用内核码边界里已存在的那一枚（`ENT_CONNECTOR_STATE_INVALID`，`step=official-state`）：它的人话是
 *   「本机这一格读不懂/读不到」，下一步是**重试**（官方服务可能稍后才 provide），由唯一那张表定成
 *   **503**；★绝不是 `ENT_INVALID_REQUEST`（那会把"本机这块还没就绪"说成"你请求写得不对"）。
 */
function unavailableConnectorEnablePort(): never {
  throw new EnterpriseConnectorEnableError(
    'ENT_CONNECTOR_STATE_INVALID',
    'the official plugin manager is not available on this profile yet',
    'official-state',
  )
}

/**
 * 组装四个端口。
 *
 * ★**内核实例只造一次**（`inFlight` 那本"正在装/卸"的账就活在实例里）：若每次调用新造一个内核，
 *   `ENT_CONNECTOR_INSTALL_IN_PROGRESS`（同一 mcpId 正在装/卸时**拒绝**而不排队）就会永久失效——
 *   那是本面最硬的一条纪律之一。故"每次调用解引用"的只是**官方管理面那一格**，不是内核实例。
 *
 * @param options - 官方管理面解引用口、平台读面、落点与留痕。
 * @returns 四个端口（失败一律抛出内核那枚稳定码）。
 */
export function createEnterpriseConnectorEnableService(
  options: EnterpriseConnectorEnableServiceOptions,
): EnterpriseConnectorEnableService {
  const requirePort = (): ConnectorEnablePort => options.port() ?? unavailableConnectorEnablePort()
  const kernel = createEnterpriseConnectorEnable({
    port: {
      installBundle: (spec, installOptions) => requirePort().installBundle(spec, installOptions),
      removeBundle: name => requirePort().removeBundle(name),
      listBundles: () => requirePort().listBundles(),
    },
    readPlatformJson: path => options.readPlatformJson(path),
    ...(options.dshHome === undefined ? {} : { dshHome: options.dshHome }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
  })

  async function status(mcpId: string): Promise<EnterpriseConnectorStatusView> {
    // ★披露与指纹走**同一份**实现（`enable` 校验的就是这一枚指纹），而「已连接」走内核那唯一读点。
    const { disclosure, fingerprint } = await readEnterpriseConnectorDisclosure(options, mcpId)
    const connection = await kernel.connection(mcpId)
    return {
      disclosure: projectConnectorDisclosure(disclosure),
      fingerprint: requireFingerprint(fingerprint, 'status'),
      connection: projectConnectorConnection(connection),
    }
  }

  async function enable(
    mcpId: string,
    confirmFingerprint?: string,
  ): Promise<EnterpriseConnectorEnableView> {
    return projectConnectorEnableResult(await kernel.enable(mcpId, confirmFingerprint))
  }

  async function disable(mcpId: string): Promise<EnterpriseConnectorDisableView> {
    return projectConnectorDisableResult(await kernel.disable(mcpId))
  }

  async function connected(): Promise<EnterpriseConnectorConnectionsView> {
    const bundles = await readConnectorOfficialBundles(requirePort())
    const { connections, dropped } = projectConnectorConnections(bundles)
    if (dropped > 0) {
      options.onError?.(
        `enterprise connector connections: ${String(dropped)} bundle(s) of this family were dropped`
          + ' [operation=GET /enterprise/api/v1/local/connectors/connected step=connected-shape]',
        undefined,
      )
    }
    return { connected: connections, complete: dropped === 0 }
  }

  return { status, enable, disable, connected }
}
