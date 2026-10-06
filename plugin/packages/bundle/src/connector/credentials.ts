/**
 * [INPUT]: 依赖 `./errors.js` 的稳定码与 `./capability.js` 的凭据键名规则；官方凭据面只以**结构性类型**出现（不 import 官方包，保持 bundle 的 peer 边界）
 * [OUTPUT]: 官方凭据面的只读端口（`ConnectorCredentialPort` / `officialConnectorCredentialPort` / `*FromContext`）、**值永不过界**的观测投影（`ConnectorCredentialObservation`）、送达判定（`connectorCredentialDeliverability`）、预检闸门（`connectorCredentialGate` / `requireConnectorCredentials`）与从端点取出待检引用 `connectorEndpointCredentialRefs`
 * [POS]: bundle 连接器纵深的**凭据段（P0-3）**。它纠正了 `connector-architecture.md` §7 那句"`authRef` → 官方 `ctx.credentials`"——对 MCP 传输**不可实现**，理由逐条在下面的长注释里（官方三处代码/文档为证）。本文件**不存值、不读值、不写值**：只用官方的 `describe`（`{configured, source?, writable}`，官方类型文档逐字 "never the value"）做**可送达性**与**动作指引**的判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterpriseConnectorError, connectorBadRequest, type EnterpriseConnectorErrorCode } from './errors.js'
import {
  CONNECTOR_CREDENTIAL_KEY_PATTERN,
  MAX_CONNECTOR_CREDENTIAL_KEY_LENGTH,
} from './capability.js'
import type { McpConnectorDescriptor } from './bundle.js'

/**
 * ★★ 本文件存在的理由：**"配了凭据"不等于"凭据能到子进程"**。三条官方依据（都可复核）：
 *
 * 1. **配置里的 `!!js` 是同步求值**：`cordis-plugin-loader/lib/index.js:233`
 *    `const evaluate = new Function("ctx", "expr", "with (ctx) { return eval(expr) }")` —— 没有 `await`，
 *    而官方凭据面的 `resolve`/`describe` 都是 **async**（`dsh-credentials` README 的两段示例）。
 *    ⇒ 配置表达式**不可能**把保管面里的值取出来当字符串用。
 * 2. **MCP 的 `env` 只收纯字符串**：`dsh-mcp-client/lib/types/index.d.ts:39` 逐字 `env: Record<string, string>`；
 *    子进程环境 = `scrubbedParentEnv()`（丢掉 `/KEY|PASSWORD|SECRET|TOKEN/i` 与 `DSH_*` 的环境名）
 *    **再叠**上配置里那份 `env`（同 README `:136`）⇒ 能到子进程的值**只有** `process.env` 里现成的那份。
 * 3. **保管文件永不进环境**：`dsh-credentials-local/README.md:115` 逐字
 *    "The product never hands the agent the file's path and **never loads the file into the environment**"。
 *
 * ⇒ 结论：今天能到达 MCP 子进程的凭据层只有 **`env`（启动环境）/ `project-env`（`<cwd>/.env`）/
 * `user-env`（`$DSH_HOME/.env`）**三层（启动时被物化进 `process.env`）；**`file`（保管文件）到不了**。
 * 而 `file` 恰好又是 `writable: true` 的那一层 ⇒ **管理端最容易做的事（在设置里存一个键）恰恰是
 * 对 MCP 无效的那一件**。所以本段把它做成一枚**显式判据**（`store-only` ⇒ 报不可用并给可行动指引），
 * 而不是让它静默变成"启动后零工具"。
 *
 * ★ 尚未做（如实登记，别当已完成）：真要支持"保管面 → 子进程"，只有两条路——
 * ①上游给 MCP 配置一个凭据感知的取值形态；②我们写一个桥接插件（订阅 `credentials/reference-updated`、
 * 把值写进 `process.env` 再触发该行重载）。②会让密钥物化进环境、且要自持重载，属**另开一刀**（P1 候选），
 * 本文件刻意不偷偷做掉它。官方在本仓的正向先例是"per operation resolve"（不变量式取值），
 * 而 MCP 子进程是"spawn 时取值"——两者语义不同，这点必须写进方案而不是含糊过去。
 */

/** 官方 `describe(ref)` 的**受控投影**：`{configured, source?, writable}`——**没有、也永远不会有** `value` 这个槽。 */
export interface ConnectorCredentialDescription {
  readonly configured: boolean
  /** 供应它的层 id；**官方口径是 provider-defined 的 string**（本机 provider 用 `env`/`file`/`project-env`/`user-env`）。 */
  readonly source?: string
  /** 活动 provider 能不能写这个引用（启动环境供的键 = 只读）。 */
  readonly writable: boolean
}

/** 官方凭据服务的结构面（不 import 官方包）。只声明**只读**的 `describe`——本段刻意不碰 `set`/`unset`/记录。 */
export interface OfficialCredentialsLike {
  describe(ref: unknown): Promise<unknown>
}

/** 注入式凭据只读端口；默认实现直接转发官方 `ctx.credentials.describe`。 */
export interface ConnectorCredentialPort {
  describe(ref: string): Promise<ConnectorCredentialDescription>
}

/** 官方默认只读端口：**原样转发**、失败原样抛出，只做字段投影（多余字段一律丢，**尤其 `value`**）。 */
export function officialConnectorCredentialPort(credentials: OfficialCredentialsLike): ConnectorCredentialPort {
  if (!isOfficialCredentials(credentials)) {
    throw connectorBadRequest('official credentials service does not expose describe')
  }
  return {
    async describe(ref) {
      const raw = await credentials.describe(ref)
      if (typeof raw !== 'object' || raw === null) {
        throw connectorBadRequest('official credentials describe did not return an object')
      }
      const row = raw as Record<string, unknown>
      if (typeof row['configured'] !== 'boolean' || typeof row['writable'] !== 'boolean') {
        throw connectorBadRequest('official credentials describe returned an unexpected shape')
      }
      const source = typeof row['source'] === 'string' && row['source'].length > 0 && row['source'].length <= 64
        ? row['source']
        : undefined
      // ★ 逐字段挑，绝不 `{...raw}` 展开：即便官方哪天把值塞进结果里，这里也过不去。
      return {
        configured: row['configured'],
        writable: row['writable'],
        ...(source === undefined ? {} : { source }),
      }
    },
  }
}

/** 形状闸门：只有具备 `describe` 函数才算官方凭据面（缺即不认，不做半可用降级）。 */
export function isOfficialCredentials(value: unknown): value is OfficialCredentialsLike {
  if (typeof value !== 'object' || value === null) return false
  return typeof (value as Record<string, unknown>)['describe'] === 'function'
}

/** 官方服务可达性：普通 Host 插件 `ctx.get('credentials')` 即可。 */
export function connectorCredentialsFromContext(ctx: { get(name: string): unknown }): OfficialCredentialsLike | undefined {
  const credentials = ctx.get('credentials')
  return isOfficialCredentials(credentials) ? credentials : undefined
}

/** Host 组合层一行接线：服务在就给只读端口，缺席即 undefined（fail-closed，不猜）。 */
export function officialConnectorCredentialPortFromContext(
  ctx: { get(name: string): unknown },
): ConnectorCredentialPort | undefined {
  const credentials = connectorCredentialsFromContext(ctx)
  return credentials === undefined ? undefined : officialConnectorCredentialPort(credentials)
}

/**
 * 会被**物化进 `process.env`** 的层：启动环境 + 两个 `.env` 层。
 *
 * ★ 这一条**已从 README 级升级为实现级取证**（三处官方坐标，逐条可复核）：
 * · `dsh-app-boot/lib/index.js` 的 `loadLayeredEnv`：`for (const [name,value] of Object.entries(layer.values))
 *   if (process.env[name] === void 0) process.env[name] = value;` —— **`.env` 两层确实写进 `process.env`**（不覆盖已有值），
 *   且同一函数构造快照时用的层 id 逐字就是 `process` / `project-env` / `user-env`；
 * · `dsh-credentials-local/lib/index.js:437-438`：`dotenvFallback(ref)` 取的就是 `['project-env','user-env']`，
 *   `:477` 把 `process` 层报成 source `'env'` ⇒ **本常量的三个值就是官方口径**（不是我起的名字）；
 * · `dsh-credentials-local/lib/index.js` 全文**零** `process.env` 写操作 ⇒ 保管文件那一层永远不进环境。
 */
export const CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES: readonly string[] = ['env', 'project-env', 'user-env']

/**
 * 保管文件层：官方明文自陈**永不进环境**（`dsh-credentials-local/README.md:115`）⇒ 到不了 MCP 子进程。
 *
 * ★ 实现级补充：`dsh-mcp-client/lib/*.js` **零**引用 `credentials`/`readRecord`/`credentialKey`
 * ⇒ 官方 MCP 客户端根本**不读凭据面**，它只吃配置里那个（同步求值的）`env`。
 * 反向也核过：`readRecord` 的消费者是 `dsh-llm-pi-ai` / `dsh-deepseek-account-platform` / `dsh-storage-json`
 * 这类**在进程内自己调凭据面**的适配器 —— 记录里的 `env` 值服务的是它们，不是子进程。
 */
export const CONNECTOR_STORE_CREDENTIAL_SOURCE = 'file'

/**
 * 一条引用的**可送达性**（不是"配没配"——那是 `configured`）：
 * - `deliverable`：值在 `process.env` 里现成有 ⇒ 配置里的 `!!js process.env.<键>` 能取到。
 * - `store-only`：只在保管文件里 ⇒ **到不了子进程**。
 * - `unknown-source`：provider 自定的层 id，我们不认识 ⇒ **fail-closed 当"送不到"**（不猜、不乐观）。
 * - `unconfigured`：没配。
 */
export type ConnectorCredentialDeliverability = 'deliverable' | 'store-only' | 'unknown-source' | 'unconfigured'

export function connectorCredentialDeliverability(
  description: ConnectorCredentialDescription,
): ConnectorCredentialDeliverability {
  if (!description.configured) return 'unconfigured'
  const source = description.source
  if (source === undefined) return 'unknown-source'
  if (source === CONNECTOR_STORE_CREDENTIAL_SOURCE) return 'store-only'
  return CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES.includes(source) ? 'deliverable' : 'unknown-source'
}

/** 管理端该说哪句话（**词表在 UI 侧**，这里只给可判定的动作 id，不产出员工可见文案）。 */
export type ConnectorCredentialAction =
  /** 没配：给出**唯一有效的做法**——用启动环境/`.env` 提供（因为保管文件送不到 MCP）。 */
  | 'provide-in-env-layer'
  /** 配在保管文件里：★必须镜像进 `.env` 或启动环境；在设置里存键对 MCP 无效。 */
  | 'mirror-into-env-layer'
  /** provider 自定层：无法判定送达，需人工核对。 */
  | 'verify-source-manually'
  /** 就绪；来源是启动环境时它**只读**（改了要重启，见 §6.2 第 5 条）。 */
  | 'none'

function actionFor(deliverability: ConnectorCredentialDeliverability): ConnectorCredentialAction {
  if (deliverability === 'unconfigured') return 'provide-in-env-layer'
  if (deliverability === 'store-only') return 'mirror-into-env-layer'
  if (deliverability === 'unknown-source') return 'verify-source-manually'
  return 'none'
}

/** 一条引用的**脱敏观测**：值没有槽位；`ref` 本身是键名（不是值），可过界。 */
export interface ConnectorCredentialObservation {
  readonly ref: string
  readonly configured: boolean
  readonly source?: string
  readonly writable: boolean
  readonly deliverability: ConnectorCredentialDeliverability
  readonly action: ConnectorCredentialAction
}

/** 预检结果：`ok` 才是"这条连接器现在装下去能真用"。失败**不抛**，由调用方决定是拒还是只展示。 */
export interface ConnectorCredentialGateResult {
  readonly ok: boolean
  readonly observations: readonly ConnectorCredentialObservation[]
  readonly errorCode?: EnterpriseConnectorErrorCode
}

/** 校验一枚凭据引用（与 `authRef`、bundle 引用键同一把尺）。 */
export function readConnectorCredentialRef(value: unknown): string {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_CONNECTOR_CREDENTIAL_KEY_LENGTH
    || !CONNECTOR_CREDENTIAL_KEY_PATTERN.test(value)) {
    throw connectorBadRequest('connector credential reference is not a POSIX identifier key name')
  }
  return value
}

/**
 * 从一条连接器端点取出它**点名的凭据引用**（stdio 的 `env[].key` / http 的 `headers[].key`）。
 * 去重 + 码元升序 ⇒ 同一条连接器永远同一份清单（预检结果可比、可断言）。
 */
export function connectorEndpointCredentialRefs(descriptor: McpConnectorDescriptor): readonly string[] {
  const endpoint = (descriptor as { endpoint?: unknown } | null | undefined)?.endpoint
  if (typeof endpoint !== 'object' || endpoint === null) return []
  const row = endpoint as Record<string, unknown>
  const list = row['transport'] === 'streamable-http' ? row['headers'] : row['env']
  if (!Array.isArray(list)) return []
  const refs = new Set<string>()
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const key = (item as Record<string, unknown>)['key']
    if (typeof key === 'string' && key.length > 0) refs.add(readConnectorCredentialRef(key))
  }
  return [...refs].sort()
}

/** 观测一条引用（**只读**，绝不取值）。 */
export async function observeConnectorCredential(
  port: ConnectorCredentialPort,
  ref: string,
): Promise<ConnectorCredentialObservation> {
  const description = await port.describe(readConnectorCredentialRef(ref))
  const deliverability = connectorCredentialDeliverability(description)
  return {
    ref,
    configured: description.configured,
    writable: description.writable,
    deliverability,
    action: actionFor(deliverability),
    ...(description.source === undefined ? {} : { source: description.source }),
  }
}

/**
 * 预检闸门：**每一条**引用都 `deliverable` 才 `ok`。
 *
 * 两种失败分开报（可行动提示不同）：
 * - 有引用 `unconfigured` ⇒ `ENT_CONNECTOR_CREDENTIAL_MISSING`；
 * - 有引用 `store-only` / `unknown-source` ⇒ `ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE`（**先于** missing 判，
 *   因为"配了却送不到"比"没配"更容易被误当成已就绪）。
 *
 * 没有任何引用（如公开只读端点）⇒ `ok`，这是合法的，不是错误。
 */
export async function connectorCredentialGate(
  port: ConnectorCredentialPort,
  refs: readonly string[],
): Promise<ConnectorCredentialGateResult> {
  const unique = [...new Set(refs.map(readConnectorCredentialRef))].sort()
  const observations: ConnectorCredentialObservation[] = []
  for (const ref of unique) observations.push(await observeConnectorCredential(port, ref))
  if (observations.some(item => item.deliverability === 'store-only' || item.deliverability === 'unknown-source')) {
    return { ok: false, observations, errorCode: 'ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE' }
  }
  if (observations.some(item => item.deliverability === 'unconfigured')) {
    return { ok: false, observations, errorCode: 'ENT_CONNECTOR_CREDENTIAL_MISSING' }
  }
  return { ok: true, observations }
}

/**
 * 严格版：失败即抛稳定码（给"装下去必须能用"的调用方用）。观测照样交回，便于路由写诊断。
 */
export async function requireConnectorCredentials(
  port: ConnectorCredentialPort,
  refs: readonly string[],
): Promise<readonly ConnectorCredentialObservation[]> {
  const result = await connectorCredentialGate(port, refs)
  if (result.ok) return result.observations
  throw new EnterpriseConnectorError(
    result.errorCode ?? 'ENT_CONNECTOR_CREDENTIAL_MISSING',
    'connector credential is missing or cannot reach the MCP child process',
  )
}
