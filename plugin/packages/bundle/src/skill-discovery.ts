/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→状态码唯一映射 `enterpriseLocalErrorStatus` 与异常摘要串
 * [OUTPUT]: 对外提供 `GET /enterprise/api/v1/local/skills/discovered` 的注册函数 `registerEnterpriseSkillDiscoveryRoute`、端口契约 `EnterpriseSkillDiscoveryPort`（`discover()` + `acquireScope()`）、查看作用域闸门 `projectSkillViewScope`、白名单投影 `projectDiscoveredSkills` + 逐键清单 `ENTERPRISE_DISCOVERED_SKILL_KEYS`、失败投影 `projectSkillDiscoveryFailure` 与唯一稳定码 `ENT_SKILL_DISCOVERY_UNAVAILABLE`
 * [POS]: bundle 的**官方发现面只读镜像**（口径 54）——与 `skill-route.ts`（企业技能目录镜像）、
 *   `skill-upload.ts`/`skill-system.ts`（本机写入口）并列的第三条只读面：它**不碰平台、不碰令牌**，
 *   只把宿主官方服务 `ctx.get('skills')` 的快照投影成浏览器能读的 `{data:{skills,complete}}`。
 *   ★**为什么要这一条**（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）：
 *   本仓原有两份"我们自己的记录"（企业中心 `installed.json` 与本机自装 `self-installed.json`），
 *   它们**必然与磁盘真值不一致**（真机取证：`~/.dsh/skills/` 上实有 7 枚技能，而企业那份记录只认 1 枚）
 *   —— "已安装"该怎么答，唯一有资格回答的是**官方自己的发现面**（它就是运行时真正加载的那一份）。
 *   ★三条硬口径：
 *   ① **只回白名单字段** —— `name`/`description`/`whenToUse?`/`invocation`/`source`/`provider`，
 *      **`path` 与 `resourceBase` 一律不出去**（那是宿主绝对路径，进了浏览器就是泄漏面；
 *      "来源"这件事由 `source` 这一枚枚举说清，不需要路径）；
 *   ② **服务缺席 / 作用域取不到 / 快照抛错 / 快照读不懂 / 租约释放失败 ⇒ 明确失败码**，
 *      **绝不静默回空列表、也绝不静默回"只有全局层"的那一部分** ——
 *      空列表不是"没读到你"，而是"谎称你什么都没装"；只读全局层则是**谎称你只装了全局层那一部分**。
 *      两种都是本仓最不能有的失败形态；
 *   ③ **只读、不读技能正文**（全文件不出现 `SKILL.md` 的读取），非 GET 405、异常 503
 *      走本包既有路由口径（`enterpriseLocalErrorStatus` 那张唯一表 + `onError` 留判定点）。
 *   ④ ★★**必须带"查看作用域"读（本刀：真机少报缺陷的修复）**。
 *      官方 `skills` 服务（`SkillRegistry` 的层叠注册表注释）契约**原文**：
 *      > "host rows and repository plugins land in the **global layer**, while **a plugin mounted by an
 *      >  agent preset's standing composition lands in that preset's layer**. A read merges the global layer
 *      >  with the **viewing scope's chain** — the nearest layer's entry wins a duplicate name outright…"
 *      读法签名 `snapshot(options: SkillViewOptions)`、`SkillViewOptions = { scope?: ScopeKey; cwd?: string; signal?: AbortSignal }`。
 *      ⇒ `scope` **不传就只读到全局层**，挂在 preset 层里的那些会被整层漏掉（**这不是报错，是少报**）。
 *      **真机取证**（口径 54 落地后暴露）：`curl 127.0.0.1:19387/enterprise/api/v1/local/skills/discovered`
 *      回 `HTTP 200 / 1579B / complete=true` 但**只有 3 条**（全部 `source=bundled` / `provider=dsh-office`：
 *      office-docx · office-pptx · office-xlsx），而 `~/.dsh/skills/` 实有 **7** 枚
 *      （agent-manager · dingtalk-connector · feishu-connector · ima-skill ·
 *      interactive-architecture-diagram · skill-creator · wecom-connector），
 *      且这 7 枚**确实出现在会话的技能目录里** ⇒ 官方发现面认识它们，是我们这一读漏了。
 *      **为什么少掉的偏偏是这 7 枚**（官方 profile patch 原文，`dsh-web-app/cordis.patch.yml`）：
 *      "the base host `skill-filesystem` row is **disabled** here (**presets own local discovery**)"，
 *      而 `presets/standard.patch.yml` 把 `skill-filesystem` 挂在**每个 preset 的 composition** 里
 *      ⇒ 文件系统 provider 注册进的是 **preset 层**，不带 `scope` 的读**永远看不到那 7 枚**。
 *      **纪律**：作用域**取不到就明确失败**（`step=scope-unavailable`），
 *      **绝不回落成"只看全局层"** —— 那正是同一条少报，只是换了个地方发生。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/**
 * 本机**官方发现面**的只读路由：`GET /enterprise/api/v1/local/skills/discovered`。
 *
 * 与 `platform-client` 那族 `/skills/{install,uninstall,installed,content,upload,self-installed,…}`
 * 并列（同一 `/enterprise/api/v1/local/skills` 前缀之下）。
 * ★它注册在 **bundle 侧**（`skill-route.ts` 已经持有 `/skills` 这条 prefix，本文件再注册一条
 * **exact** sibling）：引擎 `dsh-host-webserver` 是 exact / prefix **两张表**，exact 整路径命中
 * 先于 prefix，故 `discovered` 不会被那条 prefix handler 当成包 id 去判 400 —— 这与
 * `skill-route.ts` 自己注册 `/skills` exact 列表是同一个理由（坐标见 `skill-route.ts` 头注）。
 */
export const ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH = '/enterprise/api/v1/local/skills/discovered'

/**
 * 这条面唯一的稳定码：**本机的技能发现面这次读不到**。
 *
 * ★三种来由收在**一枚**码上，因为对员工来说是同一件事、下一步也是同一条：
 *   ① 老宿主根本没有官方 `skills` 服务（服务缺席）；
 *   ② 服务在场但 `snapshot()` 抛（官方自己的失败）；
 *   ③ 服务回了我们读不懂的东西（形状闸门不过 —— 见 `projectDiscoveredSkills`）。
 *   三者的下一步都是「重试一次；仍然失败请让管理员确认部署版本」，故不拆三枚
 *   （本仓纪律："一个码一句话"；下一步相同的失败不许各给一个码）。
 * ★**状态码走 `enterpriseLocalErrorStatus` 那张唯一表**：本码刻意**不进**那张表，
 *   落在表尾默认 503（与 `ENT_NUWAX_NOT_CONFIGURED` 同一手法：本机这块暂时不可用、可重试），
 *   因此不需要动 platform-client 一个字节。
 * ★**绝不用空列表代替它**：空列表 = "你什么都没装"，那是**假话**（用户明确点名不许）。
 */
export const ENT_SKILL_DISCOVERY_UNAVAILABLE = 'ENT_SKILL_DISCOVERY_UNAVAILABLE'

/** 一次快照里**允许**出厂的那几格；顺序即响应里的键序（用例按这个清单做逐键集合断言）。 */
export const ENTERPRISE_DISCOVERED_SKILL_KEYS = [
  'name',
  'description',
  'invocation',
  'source',
  'provider',
] as const

/** `whenToUse` 是**可选**的一格：官方没给就不给这个键（不是一个空串——"没说"与"说空"要分得开）。 */
export const ENTERPRISE_DISCOVERED_OPTIONAL_KEYS = ['whenToUse'] as const

/** 投影后的一条已发现技能（浏览器侧解码器 `decodeEnterpriseDiscoveredSkills` 收的就是这个形状）。 */
export interface EnterpriseDiscoveredSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean }
  readonly source: string
  readonly provider: string
}

/** 投影后的一次快照。`complete` 由**官方**给：`false` = 它自己说"还没发现完"。 */
export interface EnterpriseDiscoveredSkills {
  readonly skills: readonly EnterpriseDiscoveredSkill[]
  readonly complete: boolean
}

/**
 * 一次**查看作用域**的租约（官方 `agentPresets.acquireScope()` 的返回形状；结构性，**不 import 官方包**）。
 *
 * 官方契约逐字：`async acquireScope(id?: string): Promise<{ key: ScopeKey } & AsyncDisposable>`
 * （不传 `id` = 默认/当前 preset）。官方实现把返回物当**引用计数租约**：释放时递减引用、
 * 并在该 preset 已被退休时真正拆掉那棵 standing mount ⇒ **不释放 = 每个请求漏一棵挂载**。
 * ★`key` 是官方的不透明作用域身份：官方 `scopeChainOf(key)` 直接把它当 `WeakMap` 键走父链，
 *   故 `undefined`/`null`/原始值一律得到**空链**（读法静默退化成"只看全局层"）——
 *   这正是本刀要修的那条少报，因此 `projectSkillViewScope` 对 `key` 的形状**当场拒**。
 */
export interface EnterpriseSkillViewScope {
  readonly key: unknown
  /**
   * 有就传（官方契约："`cwd` selects project roots"）；**没有就不传**。
   * 组合层拿不到"当前工作区/项目根"时**不猜、不编造路径**（`process.cwd()` 绝不是它的替代）。
   * ★空串同样被拒：`resolve('')` 会变成宿主进程自己的 cwd，那就是凭空造了一条路径出来。
   */
  readonly cwd?: string
  /** 释放这次租约（官方那枚 `[Symbol.asyncDispose]` 的直译；调用方保证只调一次）。 */
  dispose(): Promise<void>
}

/** `snapshot()` 的入参：官方 `SkillViewOptions` 里我们真正会用的那三格。 */
export interface EnterpriseSkillSnapshotOptions {
  /** ★**必填**：这就是"看谁的层链"。缺席 = 只看全局层 = 少报（见文件头 ④）。 */
  readonly scope: unknown
  readonly cwd?: string
  readonly signal?: AbortSignal
}

/**
 * 宿主官方 `skills` 服务的最小面（结构性，**不 import 官方包**）。
 *
 * 契约逐字取自宿主里那个服务（`ctx.get('skills')`）：
 * `snapshot(options: SkillViewOptions) => Promise<{skills: SkillSummary[], complete: boolean}>`。
 * ★返回 `unknown` 是**有意的**：`ctx.get()` 拿到的东西在编译期本来就不受约束，
 *   把形状闸门放在**这一条边的唯一一处**（`projectDiscoveredSkills`）比在类型上"假定它是对的"诚实。
 */
export interface EnterpriseSkillSnapshotPort {
  snapshot(options: EnterpriseSkillSnapshotOptions): Promise<unknown>
}

/**
 * 组合层交给路由的端口：**每次调用现场解引用**官方服务（服务可能晚于本插件就绪）。
 *
 * ★为什么不是直接给 `EnterpriseSkillSnapshotPort`：官方服务在 apply 那刻可能还没 provide
 *   （与 `preset/wiring.ts` 那个冻结点同一个道理），把它**快照**在端口对象里就等于"启动顺序决定可用性"。
 *   端口返回 `undefined` = 此刻没有这个服务 ⇒ 路由如实回 `ENT_SKILL_DISCOVERY_UNAVAILABLE`。
 */
export interface EnterpriseSkillDiscoveryPort {
  /** 官方 `skills` 服务；此刻没有则 `undefined`（路由判 `step=service-absent`）。 */
  discover(): EnterpriseSkillSnapshotPort | undefined
  /**
   * 取"当前/默认 agent preset"的查看作用域：返回官方租约（结构见 `EnterpriseSkillViewScope`）。
   * · 返回 `undefined` = 此刻宿主没有官方 `agentPresets` 服务（老宿主）；
   * · 抛 = 有服务但这次取不到（preset 未知 / composition 不可用）。
   * 两条都由路由收敛成**同一枚明确失败码**（`step=scope-unavailable`），
   * **绝不回落成"不传 scope 的全局层读"** —— 那正是本刀要修的少报（文件头 ④）。
   * ★返回值是 `unknown`：形状闸门只放在**一处**（`projectSkillViewScope`），与 `snapshot()` 同一条纪律。
   */
  acquireScope(): Promise<unknown>
}

/** 本面抛给路由的稳定错误（只带码与一句内因；响应体里只出码）。 */
export class EnterpriseSkillDiscoveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** 日志判定点：服务缺席 / 作用域取不到 / 租约释放失败 / 快照失败必须分得开（响应对员工是同一句话，排障不是）。 */
    readonly step: SkillDiscoveryFailureProjection['step'] = 'snapshot-failed',
  ) {
    super(message)
    this.name = 'EnterpriseSkillDiscoveryError'
  }
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 与 account-state / skill-route 的错误码形状门禁同源：只回显受控标识符。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/**
 * 官方租约的释放协议 = TC39 显式资源管理的那枚 `Symbol.asyncDispose`（官方契约原文就是 `& AsyncDisposable`）。
 *
 * ★为什么要这么取：本仓 `plugin/tsconfig.base.json` 的 `lib` 停在 `ES2023`，编译器**不认识**
 *   `Symbol.asyncDispose`（也不认识 `AsyncDisposable`/`await using`，那要 `esnext.disposable`）。
 *   为一句 `await using` 去动一份被整个 workspace 共享的 tsconfig 不合算，故这里**显式取那一枚运行时符号**
 *   （Node ≥18.18 / 本机 24.18.1 上存在），并在唯一那道闸门里判它是不是函数。
 */
const ASYNC_DISPOSE: symbol = (Symbol as unknown as { readonly asyncDispose: symbol }).asyncDispose

/** 本面所有"作用域这一环"的失败共用的构造点：一枚码 + 一个判定点，消息只进 Host 日志。 */
function scopeUnavailable(message: string): EnterpriseSkillDiscoveryError {
  return new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, message, 'scope-unavailable')
}

/**
 * 把官方 `agentPresets.acquireScope()` 的返回物**收窄**成我们认的租约形状（唯一那道作用域闸门）。
 *
 * ★五条拒绝，各对应一条**真实的少报/泄漏路径**，不是形式主义：
 *   ① 不是对象 ⇒ 连 `key` 都读不出来；
 *   ② `key` 不是 WeakMap 可用键（对象/函数）⇒ 官方 `scopeChainOf` 得到**空链** ⇒ 静默"只看全局层"（本刀那条少报）；
 *   ③ 没有 `[Symbol.asyncDispose]` ⇒ 租约**释放不掉**（每次请求漏一棵 preset 挂载）⇒ 不装作没事；
 *   ④ `cwd` 在但非法（空串/非串）⇒ 空串会被 `resolve('')` 变成宿主进程的 cwd，等于**编造路径**；
 *   ⑤ `cwd` 缺席 ⇒ **合法**，只是不给这一格（"拿不到就不传"，绝不补一个猜想值）。
 *
 * @param lease - 官方 `acquireScope()` 的原始返回值（`unknown`：形状由这里判）。
 * @returns `{key, cwd?, dispose}`：`dispose` 直译官方那枚异步释放。
 * @throws {EnterpriseSkillDiscoveryError} 作用域租约读不懂（`step=scope-unavailable`）。
 */
export function projectSkillViewScope(lease: unknown): EnterpriseSkillViewScope {
  if (typeof lease !== 'object' || lease === null) {
    throw scopeUnavailable('official agent-preset scope lease is not an object')
  }
  const key: unknown = Reflect.get(lease, 'key')
  // ★判据是"WeakMap 可用键"，不是"非空"：官方父链表就是一张 WeakMap，原始值一律得空链。
  const usableKey = (typeof key === 'object' && key !== null) || typeof key === 'function'
  if (!usableKey) {
    throw scopeUnavailable('official agent-preset scope lease carries no usable scope key')
  }
  const release: unknown = Reflect.get(lease, ASYNC_DISPOSE)
  if (typeof release !== 'function') {
    throw scopeUnavailable('official agent-preset scope lease is not async-disposable')
  }
  const cwd: unknown = Reflect.get(lease, 'cwd')
  if (cwd !== undefined && (typeof cwd !== 'string' || cwd.length === 0)) {
    throw scopeUnavailable('official agent-preset scope lease carries an unusable cwd')
  }
  return {
    key,
    // ★只有真的是非空字符串才给这一格；缺席与非法在上面已经分开了。
    ...(typeof cwd === 'string' ? { cwd } : {}),
    dispose: async () => {
      await (release as () => unknown).call(lease)
    },
  }
}

/** 把已经过闸门的租约摊成 `snapshot()` 的入参（`cwd` 只在真的有时出现——**没有就不给这个键**）。 */
export function snapshotOptionsOf(scope: EnterpriseSkillViewScope): EnterpriseSkillSnapshotOptions {
  return { scope: scope.key, ...(scope.cwd === undefined ? {} : { cwd: scope.cwd }) }
}

/**
 * 取一次查看作用域，并把这一环的**所有**失败都收敛成同一枚明确失败码与同一个判定点。
 *
 * 与 `discover()` 的分工：`discover()` 回 `undefined` 表示"没有官方 skills 服务"（`step=service-absent`），
 * 这里回 `undefined` 表示"没有官方 agentPresets 服务"、抛表示"有服务但这次取不到"——
 * 两条都归 `step=scope-unavailable`：对员工是同一件事（这次读不全），对排障靠 `step` 分得开。
 *
 * @param discovery - 组合层端口。
 * @returns 收窄后的租约（调用方**必须**在 `finally`/显式两段式里释放它）。
 * @throws {EnterpriseSkillDiscoveryError} 服务缺席或租约形状不过。
 */
async function acquireSkillViewScope(discovery: EnterpriseSkillDiscoveryPort): Promise<EnterpriseSkillViewScope> {
  let raw: unknown
  try {
    raw = await discovery.acquireScope()
  } catch (error) {
    // ★官方自己的码（`agent-preset/not-found` 一类）**不**透出：那是宿主内部标识，不是本面的失败语汇。
    throw scopeUnavailable(`the host could not resolve a viewing agent-preset scope: ${thrownErrorDiagnostics(error)}`)
  }
  if (raw === undefined) {
    throw scopeUnavailable('the official agentPresets service is not available on this host')
  }
  return projectSkillViewScope(raw)
}

/** 与 usage-route / skill-route 内部 helper 等价的私有小工具；两份私有实现好过为复用而反向依赖。 */
function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/** 读一条必填字符串；不是字符串就**当场拒**（丢条目 = 少报一个技能，比失败更坏）。 */
function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      `official skills snapshot has a non-string ${key}`,
    )
  }
  return value
}

/** 读调用策略那两枚布尔（官方契约里它们必填且必是布尔）。 */
function requireInvocation(value: unknown): { readonly modelInvocable: boolean; readonly userInvocable: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot has a non-object invocation',
    )
  }
  const record = value as Record<string, unknown>
  if (typeof record['modelInvocable'] !== 'boolean' || typeof record['userInvocable'] !== 'boolean') {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot has a non-boolean invocation field',
    )
  }
  return { modelInvocable: record['modelInvocable'], userInvocable: record['userInvocable'] }
}

/**
 * 把官方快照投影成**逐键白名单**的响应体。
 *
 * ★**这是整条路由的形状闸门，也是唯一一道**：
 *   · 快照不是对象 / `skills` 不是数组 / `complete` 不是布尔 ⇒ 抛（回失败码，不回空列表）；
 *   · 逐条只**读**白名单那几格，产出的对象**从零构造**（不是"删掉 path"，是"根本不放进去"）
 *     ⇒ `path` 与 `resourceBase` 在任何输入下都不可能出厂（用例对**输出的键集**做逐键断言）；
 *   · `whenToUse` 缺席或非字符串 ⇒ **不给这个键**（可选就是可选，不编空串）；
 *   · 任一条必填格形状不对 ⇒ 抛（宁可如实失败，也不静默少报一枚）。
 * ★空列表是**合法**结果（磁盘上真的一枚都没有），它只在官方确实这么回时才出现 ——
 *   与"服务读不到"那条路泾渭分明，这正是本刀要守住的那条界线。
 *
 * @param snapshot - 官方 `snapshot()` 的原始返回值（`unknown`：形状由这里判）。
 * @returns `{skills, complete}`：逐键白名单、无宿主路径。
 * @throws {EnterpriseSkillDiscoveryError} 形状读不懂。
 */
export function projectDiscoveredSkills(snapshot: unknown): EnterpriseDiscoveredSkills {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new EnterpriseSkillDiscoveryError(
      ENT_SKILL_DISCOVERY_UNAVAILABLE,
      'official skills snapshot is not an object',
    )
  }
  const record = snapshot as Record<string, unknown>
  const raw = record['skills']
  if (!Array.isArray(raw)) {
    throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has no skills array')
  }
  if (typeof record['complete'] !== 'boolean') {
    throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has no boolean complete')
  }
  const skills: EnterpriseDiscoveredSkill[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has a non-object entry')
    }
    const each = entry as Record<string, unknown>
    const name = requireString(each, 'name')
    if (name.length === 0) {
      throw new EnterpriseSkillDiscoveryError(ENT_SKILL_DISCOVERY_UNAVAILABLE, 'official skills snapshot has an empty skill name')
    }
    const whenToUse = each['whenToUse']
    skills.push({
      name,
      description: requireString(each, 'description'),
      // 可选那一格：只有真的是非空字符串才出厂（"没说"与"说空"分得开）。
      ...(typeof whenToUse === 'string' && whenToUse.length > 0 ? { whenToUse } : {}),
      invocation: requireInvocation(each['invocation']),
      source: requireString(each, 'source'),
      provider: requireString(each, 'provider'),
      // ★`path` / `resourceBase` 就在这里被**结构性**丢掉：上面这个字面量里没有它们的位置。
    })
  }
  return { skills, complete: record['complete'] }
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface SkillDiscoveryFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'service-absent' | 'scope-unavailable' | 'scope-release-failed' | 'snapshot-failed'
}

/**
 * 失败投影的唯一判断点。
 *
 * 服务缺席（`step=service-absent`）与作用域取不到（`step=scope-unavailable`）由调用处**显式**抛同一枚码，
 * 快照抛错/形状不过（`step=snapshot-failed`）走这里。两者状态码都取
 * `enterpriseLocalErrorStatus`（本码落在表尾 ⇒ 503），**绝不折成 200 + 空列表/半份列表**。
 *
 * @param error - 取数路径逃出来的异常。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectSkillDiscoveryFailure(error: unknown): SkillDiscoveryFailureProjection {
  const code = errorCodeOf(error)
  return {
    status: enterpriseLocalErrorStatus(error),
    code: code !== undefined && CODE_SHAPE.test(code) ? code : ENT_SKILL_DISCOVERY_UNAVAILABLE,
    step: error instanceof EnterpriseSkillDiscoveryError ? error.step : 'snapshot-failed',
  }
}

/**
 * 在 Harness `ctx.webServer` 上注册**本机官方发现面**的同源只读路由。
 *
 * 四个失败面都在写状态行之前收敛成 `{error:{code}}`，异常不逃到 Cordis 顶层：
 *  · 端口缺席（组合层没接线）/ `discover()` 回 `undefined`（老宿主没有官方 `skills` 服务）⇒ `step=service-absent`；
 *  · `acquireScope()` 回 `undefined` / 抛 / 租约形状不过（没有官方 `agentPresets`、preset 取不到）⇒ `step=scope-unavailable`；
 *  · `snapshot()` 抛 / 形状不过 ⇒ `step=snapshot-failed`；
 *  · 租约释放失败 ⇒ `step=scope-release-failed`（只在没有主错误时成为这次的失败，见下）。
 * 四者**同一枚码**（对员工是同一件事：这次读不全；下一步也同一条：重试，仍失败找管理员），
 * 靠 `step` 在日志里分开 —— **绝不把任何一条折成 200**。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param discovery - 官方发现面端口；缺席即整条路由 fail-closed（一律 503 明确码）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销该路由的 disposer。
 */
export function registerEnterpriseSkillDiscoveryRoute(
  webServer: WebServerRoutePort,
  discovery?: EnterpriseSkillDiscoveryPort | undefined,
  onError?: (message: string, error: unknown) => void,
): () => void {
  return webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      let status = 200
      let body: unknown
      try {
        // ★端口整个没接线与"此刻没有官方 skills 服务"是同一件事：都判 `service-absent`、都 503。
        if (discovery === undefined) {
          throw new EnterpriseSkillDiscoveryError(
            ENT_SKILL_DISCOVERY_UNAVAILABLE,
            'the official skills service is not available on this host',
            'service-absent',
          )
        }
        const service = discovery.discover()
        if (service === undefined) {
          throw new EnterpriseSkillDiscoveryError(
            ENT_SKILL_DISCOVERY_UNAVAILABLE,
            'the official skills service is not available on this host',
            'service-absent',
          )
        }
        // ★先取"查看作用域"：不传 `scope` 的读只看得见全局层（preset 层整层漏掉）——
        //   那是本刀修掉的那条少报，取不到就明确失败，绝不回落成那种读法。
        const scope = await acquireSkillViewScope(discovery)
        // ★释放纪律：`snapshot()` 成功与否都必须释放租约；释放失败**绝不吞**，
        //   但也不能遮蔽真因 —— 主错误在时以主错误为准，释放失败另留一条日志。
        let observed: unknown
        let failure: unknown
        try {
          // ★只读：一次快照，**不读任何 SKILL.md 正文**、不写任何状态文件。
          observed = await service.snapshot(snapshotOptionsOf(scope))
        } catch (error) {
          failure = error
        }
        try {
          await scope.dispose()
        } catch (error) {
          if (failure === undefined) {
            failure = new EnterpriseSkillDiscoveryError(
              ENT_SKILL_DISCOVERY_UNAVAILABLE,
              `the agent-preset scope lease could not be released: ${thrownErrorDiagnostics(error)}`,
              'scope-release-failed',
            )
          } else {
            onError?.(`enterprise skill discovery scope lease release failed`
              + ` [operation=GET ${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH} step=scope-release-failed]`
              + ` ${thrownErrorDiagnostics(error)}`, error)
          }
        }
        if (failure !== undefined) throw failure
        // ★投影在租约释放**之后**做：它只吃返回值，不需要租约活着 ⇒ 租约持有窗口最短。
        body = { data: projectDiscoveredSkills(observed) }
      } catch (error) {
        const failure = projectSkillDiscoveryFailure(error)
        status = failure.status
        body = { error: { code: failure.code } }
        onError?.(`enterprise skill discovery request projected to ${failure.status}`
          + ` [operation=GET ${ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
      writeJson(response, status, body)
    },
  })
}
