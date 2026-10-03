/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port 与稳定码→状态码唯一映射 `enterpriseLocalErrorStatus`、本包 `./manager.js`（服务门面）、`./import.js`（文本导入）、`./errors.js`（稳定码）、`./storage/domain.js`（`LIBRARY_ROOT_TITLE`）
 * [OUTPUT]: 对外提供 `registerEnterpriseLibraryRoutes`（**一条 exact 单入口 POST** `{endpoint,payload}` + **一条 prefix 流式原件 GET**，注册面恰好两条路由）、路径常量、单入口的 endpoint 清单常量 `ENTERPRISE_LIBRARY_ENDPOINTS` 与失败投影 `projectLibraryFailure`
 * [POS]: 资料库**本机 HTTP 面**（方案 §2.2 的落点）——只做「形状门禁 + 分派 + 投影」：所有业务语义在 `manager.ts`，导入语义在 `import.ts`，路径安全在 `objects.ts`（本层**不写第二套路径判定**）。为什么保留 workdsh 的"单入口 `{endpoint,payload}`"内层协议：12 个 endpoint 里多数要带任意 id，而引擎 `exact` 表只认整条字面路径、`prefix` 表同一 path 只能注册一次（`skill-route.ts:20-27` 已记这条约束），逐 endpoint 拆 exact 会把表撑大且表达不了动态 id。**原件不再 base64 内联**（workdsh 的 `read-original` 会把 50 MiB 撑成 ~67 MiB body）：改走流式 GET，桶路径 `/objects/<assetId>/<revisionId>`，`content-type` 取资产 `mediaType`、`cache-control: no-store`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, type WebServerRoutePort } from '@dshent/platform-client'
import { LibraryError, badRequest } from './errors.js'
import { importLibraryText } from './import.js'
import type {
  LibraryAssetKind,
  LibraryAssetSource,
  LibraryAssetStatus,
  LibraryManager,
  LibrarySelectionItem,
} from './manager.js'
import type { LibraryAssetRecord, LibraryNodeRecord, LibraryRevisionRecord } from './storage/domain.js'
import { LIBRARY_ROOT_TITLE } from './storage/domain.js'
import type { LibrarySearchHit } from './search.js'

/** 本机资料库单入口路径（exact，POST）。 */
export const ENTERPRISE_LIBRARY_LOCAL_PATH = '/enterprise/api/v1/local/library'

/** 本机资料库原件流式读的 **prefix** 注册路径（不带尾斜杠：带尾斜杠会让子路径在引擎层就 404）。 */
export const ENTERPRISE_LIBRARY_OBJECTS_PREFIX = `${ENTERPRISE_LIBRARY_LOCAL_PATH}/objects`

/** 去掉一段前缀用的边界串（**含**斜杠，与注册 path 不是同一条串，切勿合并）。 */
const OBJECTS_BOUNDARY = `${ENTERPRISE_LIBRARY_OBJECTS_PREFIX}/`

/**
 * 单入口的 endpoint 清单（**P0 的 12 个**，顺序照 workdsh `A22:23-44`）。
 *
 * 与方案 §2.2 的 16 个差 4 个，差的都在草稿/流式那两族里，**逐个写明去处**：
 * · `read-original` → 不在这张表里（它是 `GET …/library/objects/<assetId>/<revisionId>` 这条 prefix 路由，见文件头）；
 * · `create-draft` / `update-draft` / `publish-draft` → **P1**（域层本刀只有四张表，没有 `drafts`，见 `storage/domain.ts` 的头部口径）。
 * 这张表是"接了哪些"的唯一真源，测试直接断言它的成员集合与本数。
 */
export const ENTERPRISE_LIBRARY_ENDPOINTS = [
  'space',
  'list',
  'create-folder',
  'import',
  'search',
  'read-text',
  'rename',
  'move',
  'remove',
  'set-asset-status',
  'task-selection',
  'set-task-selection',
] as const

/** 单入口认识的 endpoint 联合。 */
export type EnterpriseLibraryEndpoint = (typeof ENTERPRISE_LIBRARY_ENDPOINTS)[number]

/**
 * 单入口 POST 正文上限：**只装文本上传**（原件 ≤ 50 MiB 的那条上限由对象层把关，这条是传输层的早退）。
 *
 * 取 12 MiB 的理由：正文上限本身是 8 MiB（`LIBRARY_MAX_TEXT_BYTES`），JSON 转义（换行/引号/中文）
 * 最坏膨胀不到 2 倍，12 MiB 足够覆盖"合法输入永远进得来"，又让"明显超限的正文"在收字节时就被拒
 * （413），不必先把它整段读进内存再判。
 */
export const ENTERPRISE_LIBRARY_MAX_BODY_BYTES = 12 * 1024 * 1024

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 本仓 id 形状（`nd_…` / `as_…` / `rv_…` 与测试里的确定性 id 都落在这里；**不含** `/` `.` `%`，故拼不出路径）。 */
const LIBRARY_ID_SHAPE = /^[A-Za-z0-9_-]{1,128}$/

/** 资料库路由端口：取当前主体的服务门面 + 失败留痕。 */
export interface EnterpriseLibraryRoutePort {
  /** 当前主体的门面；**没有**（未登录 / 宿主还没接线）⇒ `undefined`，路由如实回 503。 */
  readonly manager: () => LibraryManager | undefined
  /** 失败留痕（操作名 / 判定点 / 原始 error）；不改变任何响应语义。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/** 一次失败被投影成的 HTTP 事实（状态码 + 稳定码）。 */
export interface LibraryFailureProjection {
  readonly status: number
  readonly code: string
}

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

/** 请求路径（引擎在 handler 之前已剥掉查询串，这里再自保一次）。 */
function pathnameOf(request: IncomingMessage): string {
  return (request.url ?? '/').split('?', 1)[0] ?? '/'
}

/**
 * 把资料库领域失败投影成 HTTP（方案 §4.4 D3）。
 *
 * 映射规则（`library/*` → 状态码）：内部错误 → **500**（唯一不走 `enterpriseLocalErrorStatus` 表的一支：
 * 表里的默认值是 503「本机暂时不可用、可重试」，与"这次真的出错了"不同义，而表里没有 500 这个出口）；
 * 不存在 → 404；冲突族（重名/键占用/不可变修订）→ 409；超限族（文件/选择集合）→ 413；
 * 其余业务拒绝（形状、名字、父节点、环、转换、配额、路径门禁）→ 400。
 */
export function projectLibraryFailure(error: unknown): LibraryFailureProjection {
  if (!(error instanceof LibraryError)) {
    // 非领域失败（正文超限的 `RangeError`、坏 JSON / 坏 content-type 的 `TypeError`、以及"还没接线"那条）
    // 一律交给唯一那张状态表判，码按它判出来的状态给一枚界面已经认识的企业码。
    const status = enterpriseLocalErrorStatus(error)
    if (status === 413) return { status, code: 'ENT_LIBRARY_TOO_LARGE' }
    if (status === 400) return { status, code: 'ENT_INVALID_REQUEST' }
    return { status, code: 'ENT_LIBRARY_UNAVAILABLE' }
  }
  const code = error.code
  if (code === 'library/internal') return { status: 500, code: 'ENT_LIBRARY_INTERNAL' }
  if (code === 'library/not-found' || code === 'library/object-missing') {
    return { status: enterpriseLocalErrorStatus({ code: 'ENT_RESOURCE_NOT_FOUND' }), code: 'ENT_RESOURCE_NOT_FOUND' }
  }
  if (code === 'library/name-conflict' || code === 'library/key-collision' || code === 'library/revision-immutable') {
    return { status: enterpriseLocalErrorStatus({ code: 'ENT_LIBRARY_CONFLICT' }), code: 'ENT_LIBRARY_CONFLICT' }
  }
  if (code === 'library/disabled') {
    return { status: enterpriseLocalErrorStatus({ code: 'ENT_LIBRARY_DISABLED' }), code: 'ENT_LIBRARY_DISABLED' }
  }
  if (code === 'library/file-too-large' || code === 'library/selection-too-large') {
    return { status: enterpriseLocalErrorStatus({ code: 'ENT_LIBRARY_TOO_LARGE' }), code: 'ENT_LIBRARY_TOO_LARGE' }
  }
  return { status: enterpriseLocalErrorStatus({ code: 'ENT_INVALID_REQUEST' }), code: 'ENT_INVALID_REQUEST' }
}

/** 一次失败的统一出口：投影 + 留痕。 */
function fail(response: ServerResponse, error: unknown, operation: string, port: EnterpriseLibraryRoutePort): void {
  const { status, code } = projectLibraryFailure(error)
  port.onError?.(`library ${operation} failed`, error)
  if (!response.headersSent) writeJson(response, status, { error: { code } })
  else response.end()
}

/**
 * 有界读取 JSON 正文。
 *
 * 超限 ⇒ `RangeError`（`enterpriseLocalErrorStatus` 把它投影成 413）；空正文/坏 JSON/非对象 ⇒ `TypeError`（400）。
 */
async function readJsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > limit) throw new RangeError('request body is too large')
    chunks.push(bytes)
  }
  if (total === 0) throw new TypeError('request body must be a JSON object')
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** 取一个必须存在的字符串字段（形状门禁：只认非空字符串，细节由服务层再判）。 */
function requireStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || value.length === 0) throw badRequest(`${key} must be a non-empty string`)
  return value
}

/** 取一个可选字符串字段（缺席 / `undefined` ⇒ `undefined`；给了就必须是非空字符串）。 */
function optionalStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) throw badRequest(`${key} must be a non-empty string`)
  return value
}

/** 取一个可空 id 字段（`null`/缺席 ⇒ `null`；字符串 ⇒ 过 id 形状门禁）。 */
function nullableIdField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !LIBRARY_ID_SHAPE.test(value)) throw badRequest(`${key} must be a library node id`)
  return value
}

/** 取一个必填 id 字段（过 id 形状门禁——**路径安全的第一道**，服务层与对象层还会各判一次）。 */
function requireIdField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || !LIBRARY_ID_SHAPE.test(value)) throw badRequest(`${key} must be a library id`)
  return value
}

function requirePayloadObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('payload must be an object')
  }
  return value as Record<string, unknown>
}

/** 节点 → 出网视图（字段名与 UI 解码器逐字同形；不含主体/域内部字段）。 */
function projectNode(node: LibraryNodeRecord): Record<string, unknown> {
  return {
    id: node.id,
    parentId: node.parentId,
    kind: node.kind,
    title: node.title,
    assetId: node.assetId,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

/** 资产 → 出网视图。 */
function projectAsset(asset: LibraryAssetRecord): Record<string, unknown> {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    mediaType: asset.mediaType,
    byteLength: asset.byteLength,
    currentRevisionId: asset.currentRevisionId,
    status: asset.status,
    source: asset.source,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

/** 修订 → 出网视图（正文不进这里：正文只走 `read-text` 或流式原件）。 */
function projectRevision(revision: LibraryRevisionRecord): Record<string, unknown> {
  return {
    id: revision.id,
    assetId: revision.assetId,
    number: revision.number,
    originalByteLength: revision.originalByteLength,
    contentByteLength: revision.contentByteLength,
    conversionStatus: revision.conversionStatus,
    createdAt: revision.createdAt,
  }
}

/** 命中 → 出网视图（保持服务层的驼峰口径；**工具的**下划线口径在 `tools.ts` 里单独投影）。 */
function projectHit(hit: LibrarySearchHit): Record<string, unknown> {
  return {
    assetId: hit.assetId,
    revisionId: hit.revisionId,
    name: hit.name,
    kind: hit.kind,
    source: hit.source,
    updatedAt: hit.updatedAt,
    folderPath: hit.folderPath,
    ...(hit.location === undefined ? {} : { location: hit.location }),
    excerpt: hit.excerpt,
  }
}

/** 选中项 → 出网视图。 */
function projectSelectionItem(item: LibrarySelectionItem): Record<string, unknown> {
  return {
    nodeId: item.nodeId,
    assetId: item.assetId,
    revisionId: item.revisionId,
    name: item.name,
    kind: item.kind,
  }
}

/** 单入口的唯一分派点：**每个 endpoint 只在这里出现一次**。 */
async function dispatchLibraryEndpoint(
  manager: LibraryManager,
  endpoint: EnterpriseLibraryEndpoint,
  payload: Record<string, unknown>,
): Promise<unknown> {
  switch (endpoint) {
    case 'space':
      return {
        rootTitle: LIBRARY_ROOT_TITLE,
        nodes: (await manager.listAllNodes()).map(projectNode),
        assets: (await manager.listAssets()).map(projectAsset),
      }
    case 'list': {
      const parentId = nullableIdField(payload, 'parentId')
      const nodes = await manager.listNodes(parentId)
      const children = new Set(nodes.filter(node => node.assetId !== null).map(node => node.assetId as string))
      return {
        nodes: nodes.map(projectNode),
        assets: (await manager.listAssets()).filter(asset => children.has(asset.id)).map(projectAsset),
      }
    }
    case 'create-folder':
      return { node: projectNode(await manager.createFolder({
        title: requireStringField(payload, 'title'),
        parentId: nullableIdField(payload, 'parentId'),
      })) }
    case 'import': {
      const imported = await importLibraryText(manager, {
        name: requireStringField(payload, 'name'),
        content: (() => {
          const content = payload['content']
          if (typeof content !== 'string') throw badRequest('content must be a string')
          return content
        })(),
        parentId: nullableIdField(payload, 'parentId'),
      })
      return { asset: projectAsset(imported.asset), revision: projectRevision(imported.revision) }
    }
    case 'search': {
      const kind = optionalStringField(payload, 'kind')
      const source = optionalStringField(payload, 'source')
      const hits = await manager.search({
        query: (() => {
          const query = payload['query']
          if (typeof query !== 'string') throw badRequest('query must be a string')
          return query
        })(),
        ...(kind === undefined ? {} : { kind: kind as LibraryAssetKind }),
        ...(source === undefined ? {} : { source: source as LibraryAssetSource }),
      })
      return { hits: hits.map(projectHit) }
    }
    case 'read-text': {
      const assetId = requireIdField(payload, 'assetId')
      const requested = optionalStringField(payload, 'revisionId')
      const asset = await manager.getAsset(assetId)
      const revisionId = requested ?? asset.currentRevisionId
      if (revisionId === null) throw new LibraryError('library/not-found', 'library asset has no revision yet')
      const document = await manager.readRevisionText(asset.id, revisionId)
      return {
        assetId: asset.id,
        revisionId: document.revision.id,
        name: asset.name,
        kind: asset.kind,
        content: document.text,
        byteLength: document.byteLength,
      }
    }
    case 'rename':
      return { node: projectNode(await manager.renameNode(
        requireIdField(payload, 'nodeId'),
        requireStringField(payload, 'title'),
      )) }
    case 'move':
      return { node: projectNode(await manager.moveNode(
        requireIdField(payload, 'nodeId'),
        nullableIdField(payload, 'parentId'),
      )) }
    case 'remove': {
      const nodeId = optionalStringField(payload, 'nodeId')
      const assetId = optionalStringField(payload, 'assetId')
      if (nodeId === undefined && assetId === undefined) throw badRequest('remove needs nodeId or assetId')
      if (!LIBRARY_ID_SHAPE.test(nodeId ?? assetId ?? '')) throw badRequest('nodeId must be a library id')
      const removed = nodeId === undefined
        ? await manager.removeAsset(assetId as string)
        : await manager.removeNode(nodeId)
      return { removed: { nodes: removed.nodes, assets: removed.assets, revisions: removed.revisions } }
    }
    case 'set-asset-status': {
      const status = requireStringField(payload, 'status')
      if (status !== 'active' && status !== 'disabled') throw badRequest('status must be active or disabled')
      return { asset: projectAsset(await manager.setAssetStatus(
        requireIdField(payload, 'assetId'),
        status as LibraryAssetStatus,
      )) }
    }
    case 'task-selection': {
      const items = await manager.selectedItems(requireStringField(payload, 'sessionId'))
      return { nodeIds: items.map(item => item.nodeId), items: items.map(projectSelectionItem) }
    }
    case 'set-task-selection': {
      const nodeIds = payload['nodeIds']
      if (!Array.isArray(nodeIds)) throw badRequest('nodeIds must be an array')
      const ids: string[] = []
      for (const value of nodeIds) {
        if (typeof value !== 'string' || !LIBRARY_ID_SHAPE.test(value)) throw badRequest('nodeIds must be library node ids')
        ids.push(value)
      }
      const selection = await manager.setSelection(requireStringField(payload, 'sessionId'), ids)
      return { nodeIds: selection.nodeIds }
    }
  }
}

/** endpoint 形状门禁：必须是本表成员（未知 endpoint 一律 400，绝不静默变成 no-op）。 */
function requireEndpoint(value: unknown): EnterpriseLibraryEndpoint {
  if (typeof value !== 'string' || !(ENTERPRISE_LIBRARY_ENDPOINTS as readonly string[]).includes(value)) {
    throw badRequest('unknown library endpoint')
  }
  return value as EnterpriseLibraryEndpoint
}

/**
 * 拆出流式 GET 的 `<assetId>/<revisionId>` 两段；形状不对 ⇒ `undefined`（调用方回 400）。
 * **只做形状**：真伪与落点由服务层/对象层判（本层不写第二套路径判定）。
 */
function parseObjectTarget(rest: string): { readonly assetId: string; readonly revisionId: string } | undefined {
  if (rest.endsWith('/')) return undefined
  const segments = rest.split('/')
  if (segments.length !== 2) return undefined
  const [assetId, revisionId] = segments as [string, string]
  if (!LIBRARY_ID_SHAPE.test(assetId) || !LIBRARY_ID_SHAPE.test(revisionId)) return undefined
  return { assetId, revisionId }
}

/** 取当前门面；没有就抛「还没接线」（投影 503，界面那句人话已经有了）。 */
function requireManager(port: EnterpriseLibraryRoutePort): LibraryManager {
  const manager = port.manager()
  if (manager === undefined) {
    const error = new Error('library is not available')
    Object.assign(error, { code: 'ENT_LIBRARY_UNAVAILABLE' })
    throw error
  }
  return manager
}

/**
 * 注册资料库本机路由（**恰好两条**）：单入口 exact + 原件流式 prefix。
 *
 * @param webServer - bundle 顶层注入的 `ctx.webServer` route port。
 * @param port - 当前主体的门面 + 留痕端口（由 `./host.ts` 绑定）。
 * @returns 注销器（两条一起撤）。
 */
export function registerEnterpriseLibraryRoutes(
  webServer: WebServerRoutePort,
  port: EnterpriseLibraryRoutePort,
): () => void {
  const disposeEntry = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_LIBRARY_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = 'entry'
      try {
        const body = await readJsonBody(request, ENTERPRISE_LIBRARY_MAX_BODY_BYTES)
        const envelope = requirePayloadObject(body)
        const endpoint = requireEndpoint(envelope['endpoint'])
        const payload = requirePayloadObject(envelope['payload'] ?? {})
        const manager = requireManager(port)
        writeJson(response, 200, { data: await dispatchLibraryEndpoint(manager, endpoint, payload) })
      } catch (error) {
        fail(response, error, operation, port)
      }
    },
  })

  const disposeObjects = webServer.register({
    kind: 'prefix',
    // 不带尾斜杠：引擎按「路径段前缀」匹配，带尾斜杠会让 /objects/<id>/<id> 在引擎层就 404。
    path: ENTERPRISE_LIBRARY_OBJECTS_PREFIX,
    handler: async (request, response) => {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET')
        return
      }
      try {
        const target = parseObjectTarget(pathnameOf(request).slice(OBJECTS_BOUNDARY.length))
        if (target === undefined) {
          writeJson(response, 400, { error: { code: 'ENT_INVALID_REQUEST' } })
          return
        }
        const manager = requireManager(port)
        const asset = await manager.getAsset(target.assetId)
        const original = await manager.readRevisionOriginal(asset.id, target.revisionId)
        response.writeHead(200, {
          'cache-control': 'no-store',
          'content-type': asset.mediaType,
          'content-length': String(original.byteLength),
          'x-content-type-options': 'nosniff',
        })
        response.end(original.bytes)
      } catch (error) {
        fail(response, error, 'read-original', port)
      }
    },
  })

  return () => {
    disposeObjects()
    disposeEntry()
  }
}
