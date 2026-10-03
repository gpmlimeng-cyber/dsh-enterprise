/**
 * [INPUT]: 依赖 platform-client 的 `ctx.webServer` route port 与 `resolveEnterpriseDshHome()`、本包 `./manager.js`、`./objects.js`、`./storage/domain.js`（域规格）、`./route.js`、`./tools.js`、`./context-injection.js`
 * [OUTPUT]: 对外提供 `createEnterpriseLibraryHost`（把纯模块接到宿主：开域 → 装对象层/服务门面 → 挂路由 + 工具 + 注入），以及门面端口 `EnterpriseLibraryHost` 与依赖 `EnterpriseLibraryHostDeps`
 * [POS]: 资料库纵深的**装配点**（方案 §2.6 的"装配点"一只：`bundle/src/index.ts` 的 `apply()` 里调一次）。三条刻意选择：① **不开第二条路由面**（只用 `ctx.webServer.register`，全仓 `connection.fetch` 零命中）；② 域与主体都**晚绑定**——域 `open` 是异步的、企业登录态可能晚到，故路由/工具/注入先带着一枚"当前门面可能为 undefined"的端口挂上，任何一次调用都实时解引用；未就绪 ⇒ 503 `ENT_LIBRARY_UNAVAILABLE`（可重试），而不是 404 或空列表；③ 失败一律经 `log` 留痕并**降级**（资料库挂了不该拖垮整个 bundle）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { resolveEnterpriseDshHome, type WebServerRoutePort } from '@dshent/platform-client'
import type { EnterpriseLibraryEventPort } from './context-injection.js'
import { registerEnterpriseLibraryInjection } from './context-injection.js'
import type { LibrarySubject } from './manager.js'
import { LibraryManager } from './manager.js'
import { LibraryObjectStore } from './objects.js'
import type { EnterpriseLibraryRoutePort } from './route.js'
import { registerEnterpriseLibraryRoutes } from './route.js'
import type { EnterpriseLibraryToolPort, EnterpriseLibraryToolRuntime } from './tools.js'
import { registerEnterpriseLibraryTools } from './tools.js'
import { LIBRARY_DOMAIN_NAME, libraryDomainSpec } from './storage/domain.js'
import type { LibraryDomainPort } from './storage/domain.js'

/**
 * 官方 `ctx.storageDomain` 的**结构镜像**（只用到 `open`）。
 *
 * 为什么镜像而不是 import `@deepseek-ai/dsh-storage-domain`：它不在 bundle 的依赖里（bundle Host 半
 * 只有 peer + dev 依赖），且与本文件同一纪律的是 `storage/domain.ts` 的四张表 schema——官方 `open(spec)`
 * 只读 `descriptorOf(spec)`（name/version/layout/tables 的 `valueSchema`），结构够了就能开。
 */
export interface EnterpriseLibraryDomainFacilityPort {
  /** 打开（或复用）一个域；★返回 `Promise<Domain>`（官方 storageDomain 是异步的）。 */
  open(spec: unknown): Promise<unknown> | unknown
}

/** 官方 `Domain` 句柄的**结构镜像**（只用到 `name`/`table`/`close`）。 */
interface EnterpriseLibraryDomainHandle {
  readonly name?: unknown
  close?: () => Promise<void>
}

/** 装配依赖：全部由 `bundle/src/index.ts` 的 `apply()` 现取现交（不做任何全局单例）。 */
export interface EnterpriseLibraryHostDeps {
  /** 落盘根（`<dshHome>/library/objects/**`）；不传就按企业同一套优先级现场决议。 */
  readonly dshHome?: string | undefined
  /** 官方存储域门面（`ctx.get('storageDomain')`）；缺席 ⇒ 资料库如实停在"还没接线"。 */
  readonly facility?: EnterpriseLibraryDomainFacilityPort | undefined
  /** 官方 `ctx.tools`（`ctx.get('tools')`）；缺席 ⇒ 不挂工具（不假装有）。 */
  readonly tools?: EnterpriseLibraryToolRuntime | undefined
  /** 官方事件面（`ctx.on` 那一面）；缺席 ⇒ 不挂注入。 */
  readonly events?: EnterpriseLibraryEventPort | undefined
  /**
   * 当前企业登录主体（`scope:'personal'` + 企业用户 id）。
   *
   * 每次取门面时**现读**：登录态晚到 / 换账号都能自然接上，不必在 apply 那一刻定生死；
   * 返回 `undefined` ＝ 还没有可归属的主体（未登录）⇒ 门面缺席、路由 503。
   */
  readonly readSubject: () => LibrarySubject | undefined
  /** 留痕（info/warn）；不改变任何响应语义。 */
  readonly log: (level: 'info' | 'warn', message: string, error?: unknown) => void
}

/** 资料库宿主句柄：`port` 交给路由/工具/注入，`start`/`dispose` 管域的生命周期。 */
export interface EnterpriseLibraryHost {
  /** 三条入口共用同一个端口（每次调用实时解引用当前门面）。 */
  readonly port: EnterpriseLibraryRoutePort & EnterpriseLibraryToolPort
  /** 打开域（幂等；失败只留痕，门面继续缺席）。 */
  start(): Promise<void>
  /** 关域（幂等；域没开也不报错）。 */
  dispose(): Promise<void>
}

/**
 * 装配资料库宿主。
 *
 * @param deps - 见 `EnterpriseLibraryHostDeps`。
 * @returns 宿主句柄（`start()` 之后门面才可能出现）。
 */
export function createEnterpriseLibraryHost(deps: EnterpriseLibraryHostDeps): EnterpriseLibraryHost {
  const dshHome = deps.dshHome ?? resolveEnterpriseDshHome()
  const objects = new LibraryObjectStore({ dshHome })
  let domain: LibraryDomainPort | undefined
  let handle: EnterpriseLibraryDomainHandle | undefined
  /** 已经 dispose 过（插件卸载）：迟到的 `open` 结果会被立刻关掉，不再交给任何人。 */
  let disposed = false
  let cached: { readonly key: string; readonly manager: LibraryManager } | undefined

  const port: EnterpriseLibraryRoutePort & EnterpriseLibraryToolPort = {
    manager(): LibraryManager | undefined {
      if (domain === undefined) return undefined
      const subject = deps.readSubject()
      if (subject === undefined) return undefined
      const key = `${subject.scope}:${subject.ownerId}`
      if (cached !== undefined && cached.key === key) return cached.manager
      // 换主体就换门面（域与对象层不变）：登录态晚到、切账号都走这一条，不必重启插件。
      const manager = new LibraryManager({
        domain,
        objects,
        subject,
        onError: (message, error) => { deps.log('warn', `owndsh: ${message}`, error) },
      })
      cached = { key, manager }
      return manager
    },
    onError: (message, error) => { deps.log('warn', `owndsh: ${message}`, error) },
  }

  return {
    port,
    async start(): Promise<void> {
      // 已经开过、或已经 dispose 过（插件卸载）都不再开第二次：`open` 是异步的，
      // 若它在 dispose 之后才返回，句柄会被**立刻关掉**而不是永久漏着（见下面 disposed 分支）。
      if (handle !== undefined || disposed) return
      if (deps.facility === undefined) {
        deps.log('warn', 'owndsh: library storage domain service is not mounted; library stays unavailable')
        return
      }
      try {
        // ★必须 await：官方 `ctx.storageDomain.open(spec)` 返回 `Promise<Domain>`（引擎自身用法
        // `const domain = await this.ctx.storageDomain.open(workspaceDomainSpec)`）。不 await 的话
        // `opened` 是 Promise，存进 `handle`/`domain` 后 `LibraryManager` 构造期
        // `options.domain.table('nodes')` 抛 `table is not a function` —— 而且这个 throw 发生在
        // 工具的异步调用里，只给 message 没堆栈（turn/end reason.kind=error）。
        const opened = await deps.facility.open(libraryDomainSpec)
        if (disposed) {
          await (opened as EnterpriseLibraryDomainHandle).close?.().catch((error: unknown) => {
            deps.log('warn', 'owndsh: library domain opened after dispose could not be closed', error)
          })
          return
        }
        handle = opened as EnterpriseLibraryDomainHandle
        domain = opened as unknown as LibraryDomainPort
        deps.log('info', `owndsh: library domain '${LIBRARY_DOMAIN_NAME}' opened at ${dshHome}`)
      } catch (error) {
        handle = undefined
        domain = undefined
        deps.log('warn', 'owndsh: library domain could not be opened', error)
      }
    },
    async dispose(): Promise<void> {
      disposed = true
      const closing = handle
      handle = undefined
      domain = undefined
      cached = undefined
      await closing?.close?.().catch((error: unknown) => {
        deps.log('warn', 'owndsh: library domain close failed', error)
      })
    },
  }
}

/**
 * 把宿主的三个面一次挂齐：**本机路由 + Host 工具 + system-prompt 注入**。
 *
 * 每个面各自一个注销器（调用方各自 `ctx.effect` 包一次即可，互不牵连）：
 * 路由缺席时工具照样在（工具不依赖 HTTP），工具面缺席时路由照样在——**没有任何一条会因此整包失败**。
 *
 * @param host - `createEnterpriseLibraryHost` 的返回值。
 * @param deps - 需要挂的面（未提供的面如实不挂）。
 * @returns 三个面的注销器（按注册逆序撤）。
 */
export function mountEnterpriseLibraryFaces(
  host: EnterpriseLibraryHost,
  deps: {
    readonly webServer: WebServerRoutePort
    readonly tools?: EnterpriseLibraryToolRuntime | undefined
    readonly events?: EnterpriseLibraryEventPort | undefined
  },
): () => void {
  const disposers: (() => void)[] = [registerEnterpriseLibraryRoutes(deps.webServer, host.port)]
  if (deps.tools !== undefined) disposers.push(registerEnterpriseLibraryTools(deps.tools, host.port))
  if (deps.events !== undefined) disposers.push(registerEnterpriseLibraryInjection(deps.events, host.port))
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
