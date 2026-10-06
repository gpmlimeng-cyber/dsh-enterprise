/**
 * [INPUT]: 依赖 node:crypto/node:fs/promises/node:path、platform-client 的 `resolveEnterpriseDshHome`，以及一条 MCP 连接器的形状事实（id / 显示名 / 冻结的 serverName / stdio 或 streamable-http 端点）
 * [OUTPUT]: 对外提供 `renderConnectorBundle`（逐字节产出 `package.json` + `cordis.patch.yml` 两个文件）、`connectorBundleDigest`、`synthesizeConnectorBundle`（原子、幂等、可枚举）、命名助手 `connectorRowId`/`connectorBundlePackageName`/`connectorServerNameFromId`/`connectorToolNamePrefix` 与常量族
 * [POS]: bundle 连接器纵深的**合成段**（P0-2）——把一条连接器变成官方唯一安装面认识的**配置型 bundle**（恰好两个文件，patch 里 insert 一条 `@deepseek-ai/dsh-mcp-client`）。字段契约逐条照 `docs/plan/mcp-conformance.md` §3/§4 与官方 `templates/mcp/`；**本文件只合成、不安装、不联网、不写 profile 的任何文件**（§10.1 第一条硬边界）。落点 `<dshHome>/enterprise/connector-bundles/<连接器 id>/<内容摘要>/`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterpriseConnectorError, connectorBadRequest } from './errors.js'
import { CONNECTOR_CREDENTIAL_KEY_PATTERN } from './capability.js'

/** 连接器合成的最小 bundle 落根（`<dshHome>` 下），与 `enterprise/preset-bundles` 同级。 */
export const CONNECTOR_BUNDLE_ROOT_SEGMENTS = ['enterprise', 'connector-bundles'] as const
/** 最小 bundle 里**恰好**这两个文件；顺序即磁盘上应有的全集。 */
export const CONNECTOR_BUNDLE_FILENAMES = ['cordis.patch.yml', 'package.json'] as const
/** 官方已发布的 MCP 客户端包名（本 bundle 的 patch 只 insert 这一条）。 */
export const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client' as const
/** 官方只有这两种传输（`README:57`、`index.d.ts:76`；**没有** sse）。 */
export const MCP_TRANSPORTS = ['stdio', 'streamable-http'] as const
export type McpTransport = (typeof MCP_TRANSPORTS)[number]
/** `serverName` 的官方取值域（`README:58`、`index.d.ts:31-34`）。 */
export const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** 连接器 id 的形状（企业目录的稳定标识；`install.ts` 卸载路径要用同一把尺，故导出）。 */
export const CONNECTOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_CONNECTOR_ID_LENGTH = 64
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const HEADER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,63}$/
const MAX_DISPLAY_NAME_LENGTH = 120
const MAX_COMMAND_LENGTH = 1024
const MAX_URL_LENGTH = 2048
const MAX_ARGS = 64
const MAX_ARG_LENGTH = 1024
const MAX_REFS = 16
const MAX_SERVER_NAME_LENGTH = 32
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const BUNDLE_DIGEST_DOMAIN = 'dsh-ent-connector-bundle/v1'

/**
 * 一条凭据**引用**：`name` 是它落在配置里的位置（stdio 的环境变量名 / http 的头名），
 * `key` 是它在**宿主环境里的凭据键名**。
 *
 * ★ 这里**没有、也永远不会有**"值"这个字段：`mcp-conformance.md` §4.7 逐字要求用 Loader `!!js`
 * 引用（配置里只出现键名，值只住在凭据面）。任何携带 `value`/`token`/`secret` 的写法都会被
 * `ENT_CONNECTOR_SECRET_INLINE` 当场拒。
 */
export interface McpCredentialReference {
  readonly name: string
  readonly key: string
  /** 只有 http 头允许 `Bearer`（走官方 `!!js '\`Bearer ${process.env.X}\`'` 那种模板引用写法）。 */
  readonly scheme?: 'Bearer'
}

/** stdio 端点（官方最小写法：`serverName` + `transport` + `command`）。 */
export interface McpStdioEndpoint {
  readonly transport: 'stdio'
  readonly command: string
  readonly args?: readonly string[]
  readonly cwd?: string
  readonly env?: readonly McpCredentialReference[]
}

/** streamable-http 端点（官方最小写法：`serverName` + `transport` + `url`）。 */
export interface McpHttpEndpoint {
  readonly transport: 'streamable-http'
  readonly url: string
  readonly headers?: readonly McpCredentialReference[]
}

/** 一条待合成的连接器。 */
export interface McpConnectorDescriptor {
  /** 连接器 id（企业目录里的稳定标识）；小写字母/数字/连字符。 */
  readonly id: string
  /** 员工看到的显示名（**不是** `serverName`）。 */
  readonly displayName: string
  /** 本地命名空间，由企业冻结；改名 = 改工具名（`README:75`/`:108`），故它是产物身份的一部分。 */
  readonly serverName: string
  /** 制品版本；只进我们自己的 `package.json.version`。 */
  readonly version?: string
  readonly endpoint: McpStdioEndpoint | McpHttpEndpoint
}

/** 合成结果：两个文件的正文 + 身份 + 稳定摘要。 */
export interface RenderedConnectorBundle {
  readonly connectorId: string
  readonly rowId: string
  readonly packageName: string
  readonly serverName: string
  readonly displayName: string
  readonly version: string
  readonly packageJson: string
  readonly cordisPatch: string
  readonly digest: string
  /** 模型看到的工具名前缀 `mcp__<serverName>__`（§4.3 的不可逆契约，交回调用方一份可断言的形状）。 */
  readonly toolNamePrefix: string
}

/** `synthesizeConnectorBundle` 的落盘结果。 */
export interface SynthesizedConnectorBundle extends RenderedConnectorBundle {
  readonly bundleDir: string
  readonly fileNames: readonly string[]
}

/** 落盘选项（与 `synthesizePresetBundle` 同形）。 */
export interface SynthesizeConnectorBundleOptions {
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  readonly env?: NodeJS.ProcessEnv
}

/** Loader row id：`connector-<连接器 id>`（一个条目 = 一个服务器，故 id 进 row id）。 */
export function connectorRowId(connectorId: string): string {
  return `connector-${connectorId}`
}

/** bundle 包名：**不带 scope**（避免多一层 `node_modules/@scope` 残壳，与配方纵深同一条纪律）。 */
export function connectorBundlePackageName(connectorId: string): string {
  return `dsh-ent-connector-${connectorId}`
}

/**
 * `serverName` 的默认取值：连接器 id 能塞进官方 32 字符域就用它自己，塞不进**当场抛**。
 *
 * ★ 刻意**不**做截断/哈希折叠：`serverName` 是本地命名空间，改名（含截断）会改掉模型看到的工具名、
 * 作废会话历史与权限规则（§4.3）。超过 32 字符时，由企业侧显式冻结一个短名并传 `serverName`。
 */
export function connectorServerNameFromId(connectorId: string): string {
  const id = requirePatternText('connector id', connectorId, CONNECTOR_ID_PATTERN, MAX_CONNECTOR_ID_LENGTH)
  if (!MCP_SERVER_NAME_PATTERN.test(id)) {
    throw new EnterpriseConnectorError(
      'ENT_CONNECTOR_DECLARATION_INVALID',
      'connector id does not fit the official serverName domain (1-32 chars); freeze an explicit serverName instead of truncating it',
    )
  }
  return id
}

/** 模型看到的工具名前缀（`mcp__<serverName>__`，`README:75`）。 */
export function connectorToolNamePrefix(serverName: string): string {
  return `mcp__${serverName}__`
}

/**
 * **纯函数**：把一条连接器渲染成恰好两个文件的完整正文。
 *
 * 逐条对齐官方与方案（左边是产物里的字段，右边是约束出处）：
 *
 * | 产物 | 取值 | 出处 |
 * |---|---|---|
 * | `package.json.name` | `dsh-ent-connector-<id>` | 官方要求"唯一名字"（`mcp-bundle.md:3`） |
 * | `package.json.version` | 缺省 `1.0.0` | 同上 |
 * | `package.json.dsh.bundle.patch` | `./cordis.patch.yml` | `templates/mcp/package.json:6` 逐字 |
 * | patch `id` | `connector-<id>` | 官方模板的 `demo-mcp` 同形；一条条目 = 一个服务器 |
 * | patch `name` | `@deepseek-ai/dsh-mcp-client` | 官方模板逐字 |
 * | `config.serverName` | 由企业冻结 | `README:58`（`[A-Za-z0-9_-]{1,32}`、作用域内唯一） |
 * | `config.transport` | `stdio` / `streamable-http` | `README:57`（**无 sse**） |
 * | `config.command` / `args` / `cwd` | 仅 stdio | `README:59` |
 * | `config.url` / `headers` | 仅 streamable-http | `README:60` |
 * | `config.env` / `headers` 的值 | **只有** `!!js` 引用 | `mcp-conformance.md` §4.7（明文一律拒） |
 * | `config.failOnStartupError` | **恒 `true`** | §4.2：宁可该行显式失败，也不要"看起来配好了但零工具"（官方模板也是 `true`） |
 *
 * 未写的官方字段（`toolCallTimeoutMs` / `maxInstructionBytes` / `reconnect.*`）一律**不写**，
 * 让官方默认值生效 —— 企业侧不复制官方默认值，免得官方改了默认我们还钉着旧数。
 *
 * @throws {EnterpriseConnectorError} `ENT_CONNECTOR_DECLARATION_INVALID`（形状/取值域）或 `ENT_CONNECTOR_SECRET_INLINE`（明文凭据）
 */
export function renderConnectorBundle(descriptor: McpConnectorDescriptor): RenderedConnectorBundle {
  if (typeof descriptor !== 'object' || descriptor === null || Array.isArray(descriptor)) {
    throw connectorBadRequest('connector descriptor must be an object')
  }
  const raw = descriptor as unknown as Record<string, unknown>
  rejectKeys(raw, ['id', 'displayName', 'serverName', 'version', 'endpoint'], 'connector descriptor')
  const connectorId = requirePatternText('connector id', raw['id'], CONNECTOR_ID_PATTERN, MAX_CONNECTOR_ID_LENGTH)
  const displayName = requireText('connector displayName', raw['displayName'], MAX_DISPLAY_NAME_LENGTH)
  const serverName = requirePatternText(
    'connector serverName',
    raw['serverName'],
    MCP_SERVER_NAME_PATTERN,
    MAX_SERVER_NAME_LENGTH,
  )
  const version = requireVersion(raw['version'])
  const endpoint = readEndpoint(raw['endpoint'])
  const configLines = endpoint.transport === 'stdio'
    ? renderStdioConfig(endpoint)
    : renderHttpConfig(endpoint)
  const patchLines = [
    '# generated by dshent-plugin connector synthesis: one @deepseek-ai/dsh-mcp-client row.',
    `# 连接器 ${connectorId}：字段契约见 docs/plan/mcp-conformance.md §4；请勿手改（改 serverName = 改工具名）。`,
    '- insert:',
    `    - id: ${connectorRowId(connectorId)}`,
    `      name: '${MCP_CLIENT_MODULE}'`,
    '      config:',
    `        serverName: ${serverName}`,
    ...configLines,
    '        failOnStartupError: true',
    '',
  ]
  const cordisPatch = patchLines.join('\n')
  const packageJson = `${JSON.stringify({
    name: connectorBundlePackageName(connectorId),
    version,
    private: true,
    type: 'module',
    description: displayName,
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2)}\n`
  return Object.freeze({
    connectorId,
    rowId: connectorRowId(connectorId),
    packageName: connectorBundlePackageName(connectorId),
    serverName,
    displayName,
    version,
    packageJson,
    cordisPatch,
    digest: connectorBundleDigest(packageJson, cordisPatch),
    toolNamePrefix: connectorToolNamePrefix(serverName),
  })
}

/** 两个文件正文的稳定摘要；同一连接器 + 同一配置 ⇒ 同一摘要 ⇒ 同一目录（"修同一个 bundle，不重复建"）。 */
export function connectorBundleDigest(packageJson: string, cordisPatch: string): string {
  return createHash('sha256')
    .update(`${BUNDLE_DIGEST_DOMAIN}\n`)
    .update(packageJson)
    .update('\u0000')
    .update(cordisPatch)
    .digest('hex')
}

/** 最小 bundle 的落根：`<dshHome>/enterprise/connector-bundles`。 */
export function connectorBundleRoot(options: SynthesizeConnectorBundleOptions = {}): string {
  return join(resolveEnterpriseDshHome(options), ...CONNECTOR_BUNDLE_ROOT_SEGMENTS)
}

/**
 * 落盘合成：**幂等、原子、可枚举**（与 `synthesizePresetBundle` 同一套纪律，不另造第二套）。
 *
 * 同一连接器 + 同一配置 ⇒ 同一摘要 ⇒ 同一目录（已存在且逐字节相同即直接复用，不重写）；
 * 写盘走 `<declRoot>/.staging-<uuid>` + `rename`，并做 realpath 三重等式（落根 / 连接器目录 / 摘要目录）。
 *
 * ★ 本函数**只写我们自己的落根**：`<DSH_HOME>/profiles/<name>/` 之下的那两个文件由官方 `install_bundle` 负责，
 * 手写它们就是违规（`SKILL.md:10`，判据见 `mcp-conformance.md` §2）。
 *
 * @throws {EnterpriseConnectorError} `ENT_CONNECTOR_*`（形状/明文）或 `ENT_CONNECTOR_BUNDLE_WRITE_FAILED`（落盘/路径）
 */
export async function synthesizeConnectorBundle(
  options: SynthesizeConnectorBundleOptions,
  descriptor: McpConnectorDescriptor,
): Promise<SynthesizedConnectorBundle> {
  const rendered = renderConnectorBundle(descriptor)
  const home = resolveEnterpriseDshHome(options)
  const root = join(home, ...CONNECTOR_BUNDLE_ROOT_SEGMENTS)
  try {
    // `home` 本身可能经符号链接（Android 上 `/data/user/0` ↔ `/data/data`），故等式一律拿 realpath 比 realpath。
    await mkdir(home, { recursive: true, mode: 0o700 })
    const realHome = await realpath(home)
    await mkdir(root, { recursive: true, mode: 0o700 })
    const realRoot = await realpath(root)
    if (realRoot !== join(realHome, ...CONNECTOR_BUNDLE_ROOT_SEGMENTS)) {
      throw new Error('connector bundle root escapes the harness home')
    }
    const declRoot = join(root, rendered.connectorId)
    await mkdir(declRoot, { recursive: true, mode: 0o700 })
    const realDeclRoot = await realpath(declRoot)
    if (realDeclRoot !== join(realRoot, rendered.connectorId)) {
      throw new Error('connector bundle directory escapes the bundle root')
    }
    const target = join(realDeclRoot, rendered.digest)
    const existing = await readBundleDirectory(target)
    if (existing !== undefined) {
      if (existing.packageJson !== rendered.packageJson || existing.cordisPatch !== rendered.cordisPatch) {
        throw new Error('connector bundle digest directory holds different bytes')
      }
      return Object.freeze({ ...rendered, bundleDir: target, fileNames: [...CONNECTOR_BUNDLE_FILENAMES] })
    }
    const staging = join(realDeclRoot, `.staging-${randomUUID()}`)
    await mkdir(staging, { recursive: false, mode: 0o700 })
    try {
      await writeFile(join(staging, 'package.json'), rendered.packageJson, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      await writeFile(join(staging, 'cordis.patch.yml'), rendered.cordisPatch, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      const entries = (await readdir(staging)).sort()
      if (entries.join(',') !== CONNECTOR_BUNDLE_FILENAMES.join(',')) {
        throw new Error('connector bundle staging does not hold exactly the two expected files')
      }
      try {
        await rename(staging, target)
      } catch (error) {
        // 只有并发者先我们一步放好**同样内容**时才接受；否则原样抛。
        const raced = await readBundleDirectory(target)
        if (raced === undefined
          || raced.packageJson !== rendered.packageJson
          || raced.cordisPatch !== rendered.cordisPatch) throw error
      }
    } catch (error) {
      await rm(staging, { force: true, recursive: true }).catch(() => undefined)
      throw error
    }
    const realTarget = await realpath(target)
    if (realTarget !== join(realDeclRoot, rendered.digest) || !realTarget.startsWith(realRoot + sep)) {
      throw new Error('connector bundle directory failed the realpath equality check')
    }
    return Object.freeze({ ...rendered, bundleDir: realTarget, fileNames: [...CONNECTOR_BUNDLE_FILENAMES] })
  } catch (error) {
    if (error instanceof EnterpriseConnectorError) throw error
    throw new EnterpriseConnectorError(
      'ENT_CONNECTOR_BUNDLE_WRITE_FAILED',
      'connector bundle could not be written',
      { cause: error },
    )
  }
}

interface BundleDirectoryBytes {
  readonly packageJson: string
  readonly cordisPatch: string
}

/** 读一个已存在的摘要目录；目录不存在返回 undefined，多/少一个文件即视为可疑。 */
async function readBundleDirectory(dir: string): Promise<BundleDirectoryBytes | undefined> {
  let entries: string[]
  try {
    entries = (await readdir(dir)).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  if (entries.join(',') !== CONNECTOR_BUNDLE_FILENAMES.join(',')) {
    throw new Error('connector bundle directory does not hold exactly the two expected files')
  }
  return {
    packageJson: await readFile(join(dir, 'package.json'), 'utf8'),
    cordisPatch: await readFile(join(dir, 'cordis.patch.yml'), 'utf8'),
  }
}

/** stdio 的 config 行（`serverName` 之后、`failOnStartupError` 之前）。 */
function renderStdioConfig(endpoint: McpStdioEndpoint): readonly string[] {
  const lines = [
    '        transport: stdio',
    `        command: ${yamlScalar(endpoint.command)}`,
  ]
  const args = endpoint.args
  if (args !== undefined && args.length > 0) {
    if (args.length > MAX_ARGS) throw declarationInvalid('connector args are too many')
    lines.push('        args:')
    for (const arg of args) {
      const text = requireText('connector arg', arg, MAX_ARG_LENGTH)
      lines.push(`          - ${yamlScalar(text)}`)
    }
  }
  if (endpoint.cwd !== undefined) lines.push(`        cwd: ${yamlScalar(requireText('connector cwd', endpoint.cwd, MAX_URL_LENGTH))}`)
  const refs = readCredentialReferences(endpoint.env, 'env')
  if (refs.length > 0) {
    lines.push('        env:')
    for (const ref of refs) lines.push(`          ${ref.name}: ${credentialScalar(ref)}`)
  }
  return lines
}

/** streamable-http 的 config 行。 */
function renderHttpConfig(endpoint: McpHttpEndpoint): readonly string[] {
  const url = requireText('connector url', endpoint.url, MAX_URL_LENGTH)
  if (!/^https?:\/\//.test(url)) throw declarationInvalid('connector url must be an http(s) URL')
  const lines = [
    '        transport: streamable-http',
    `        url: ${yamlScalar(url)}`,
  ]
  const refs = readCredentialReferences(endpoint.headers, 'headers')
  if (refs.length > 0) {
    lines.push('        headers:')
    for (const ref of refs) lines.push(`          ${ref.name}: ${credentialScalar(ref)}`)
  }
  return lines
}

/**
 * 凭据引用**唯一**的渲染方式（Loader `!!js`）：
 *
 * ```yaml
 * KEY:  !!js process.env.HOST_KEY                    # stdio env
 * X-Key: !!js process.env.HOST_KEY                   # http header（裸引用）
 * Authorization: !!js '`Bearer ${process.env.HOST_KEY}`'   # http header（Bearer 模板）
 * ```
 *
 * 逐字照官方两处示例（`README:43` / `README:52`）。
 */
function credentialScalar(ref: McpCredentialReference): string {
  if (ref.scheme === 'Bearer') return "!!js '`Bearer ${process.env." + ref.key + "}`'"
  return `!!js process.env.${ref.key}`
}

function readEndpoint(value: unknown): McpStdioEndpoint | McpHttpEndpoint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw declarationInvalid('connector endpoint must be an object')
  }
  const raw = value as Record<string, unknown>
  const transport = raw['transport']
  if (transport === 'stdio') {
    rejectKeys(raw, ['transport', 'command', 'args', 'cwd', 'env'], 'stdio endpoint')
    const command = requireText('connector command', raw['command'], MAX_COMMAND_LENGTH)
    const args = raw['args'] === undefined
      ? undefined
      : requireStringArray('connector args', raw['args'], MAX_ARGS, MAX_ARG_LENGTH)
    const cwd = raw['cwd'] === undefined ? undefined : requireText('connector cwd', raw['cwd'], MAX_URL_LENGTH)
    const env = readReferenceArray(raw['env'], 'env', ENV_NAME_PATTERN)
    // ★ stdio 的 env **不**接受 Bearer：那是给 HTTP 头用的引用写法，写进环境变量只会把 "Bearer " 变成值的一部分。
    return Object.freeze({
      transport: 'stdio',
      command,
      ...(args === undefined ? {} : { args }),
      ...(cwd === undefined ? {} : { cwd }),
      ...(env === undefined ? {} : { env }),
    })
  }
  if (transport === 'streamable-http') {
    rejectKeys(raw, ['transport', 'url', 'headers'], 'streamable-http endpoint')
    const url = requireText('connector url', raw['url'], MAX_URL_LENGTH)
    const headers = readReferenceArray(raw['headers'], 'headers', HEADER_NAME_PATTERN)
    return Object.freeze({
      transport: 'streamable-http',
      url,
      ...(headers === undefined ? {} : { headers }),
    })
  }
  throw declarationInvalid('connector endpoint.transport must be one of: stdio, streamable-http')
}

/** 读一组凭据引用；**任何**"直接写值"的形状都在这里被拒（`ENT_CONNECTOR_SECRET_INLINE`）。 */
function readReferenceArray(
  value: unknown,
  label: 'env' | 'headers',
  namePattern: RegExp,
): readonly McpCredentialReference[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    // 对象映射（`{ GITHUB_TOKEN: 'ghp_…' }`）正是"把机密抄进配置"的旧写法 ⇒ 明确判它，而不是笼统地说形状错。
    if (typeof value === 'object' && value !== null && Object.keys(value as Record<string, unknown>).length > 0) {
      throw secretInline(`connector ${label} must be credential references (name/key), not literal values`)
    }
    throw declarationInvalid(`connector ${label} must be an array of credential references`)
  }
  if (value.length === 0) throw declarationInvalid(`connector ${label} must not be an empty array`)
  if (value.length > MAX_REFS) throw declarationInvalid(`connector ${label} has too many entries`)
  const seen = new Set<string>()
  const refs: McpCredentialReference[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      throw secretInline(`connector ${label} entry is a literal string; reference a credential key instead`)
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw declarationInvalid(`connector ${label} entries must be objects`)
    }
    const raw = entry as Record<string, unknown>
    for (const key of Object.keys(raw)) {
      if (key === 'name' || key === 'key' || key === 'scheme') continue
      if (/value|secret|token|password|credential|api[_-]?key|access[_-]?key/i.test(key)) {
        throw secretInline(`connector ${label} entry carries ${key}; only the credential key name may be written`)
      }
      throw declarationInvalid(`connector ${label} entry carries an unknown key: ${key}`)
    }
    const name = requirePatternText(`connector ${label} name`, raw['name'], namePattern, 64)
    const keyName = requirePatternText(`connector ${label} credential key`, raw['key'], CONNECTOR_CREDENTIAL_KEY_PATTERN, 64)
    const scheme = raw['scheme']
    if (scheme !== undefined && scheme !== 'Bearer') {
      throw declarationInvalid(`connector ${label} scheme must be Bearer when present`)
    }
    if (scheme === 'Bearer' && label === 'env') {
      throw declarationInvalid('connector env entries must be bare references; Bearer only applies to http headers')
    }
    if (seen.has(name)) throw declarationInvalid(`connector ${label} lists ${name} twice`)
    seen.add(name)
    refs.push(Object.freeze(scheme === 'Bearer' ? { name, key: keyName, scheme: 'Bearer' as const } : { name, key: keyName }))
  }
  return Object.freeze(refs)
}

/** 有 `env`/`headers` 且解析出条目时用；否则返回空表（渲染期决定要不要写那一段）。 */
function readCredentialReferences(
  value: readonly McpCredentialReference[] | undefined,
  label: 'env' | 'headers',
): readonly McpCredentialReference[] {
  if (value === undefined) return []
  const refs = readReferenceArray(value, label, label === 'env' ? ENV_NAME_PATTERN : HEADER_NAME_PATTERN)
  return refs ?? []
}

function rejectKeys(raw: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) throw declarationInvalid(`${label} carries an unknown key: ${key}`)
  }
}

function requireStringArray(label: string, value: unknown, max: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value)) throw declarationInvalid(`${label} must be an array`)
  if (value.length === 0) throw declarationInvalid(`${label} must not be an empty array`)
  if (value.length > max) throw declarationInvalid(`${label} is too long`)
  return Object.freeze(value.map(entry => requireText(label, entry, maxLength)))
}

function requireVersion(value: unknown): string {
  if (value === undefined) return '1.0.0'
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value)) {
    throw declarationInvalid('connector version is not a semver string')
  }
  return value
}

function requireText(label: string, value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw declarationInvalid(`${label} must be a non-empty string of at most ${max} characters`)
  }
  return value
}

function requirePatternText(label: string, value: unknown, pattern: RegExp, max: number): string {
  const text = requireText(label, value, max)
  if (!pattern.test(text)) throw declarationInvalid(`${label} must match ${String(pattern)}`)
  return text
}

/** 把 YAML 纯量安全地写进块上下文：能裸写就裸写，否则退化成双引号 JSON 标量（与配方纵深同一把尺）。 */
function yamlScalar(value: string): string {
  if (value.length > 0
    && !/[\n\r\t]/.test(value)
    && /^[^\s\-?:,[\]{}#&*!|>'"%@`]/.test(value)
    && !/[:#]\s/.test(value)
    && !/:\s*$/.test(value)) {
    return value
  }
  return JSON.stringify(value)
}

function declarationInvalid(message: string): EnterpriseConnectorError {
  return new EnterpriseConnectorError('ENT_CONNECTOR_DECLARATION_INVALID', message)
}

function secretInline(message: string): EnterpriseConnectorError {
  return new EnterpriseConnectorError('ENT_CONNECTOR_SECRET_INLINE', message)
}
