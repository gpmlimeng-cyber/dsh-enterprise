/**
 * [INPUT]: 依赖注入进来的域端口（官方 `ctx.storageDomain.open(spec)` 或测试假实现）、注入进来的对象层端口（`LibraryObjectStore` 或带埋点的测试替身）、以及本包的 `keys.js`（主键归一化）、`storage/domain.js`（四张表 schema 与记录类型）、`objects.js`（不可变原件落盘）、`errors.js`（稳定码）
 * [OUTPUT]: 对外提供 `LibraryManager`（资料库领域服务门面：节点树 / 资产 / 不可变修订 / 会话选择的增删改查与级联删除 / 检索 `search`）、它的构造参数与输入输出类型、`LibraryLimits` 默认值（5 GiB 主体配额 / 32 个选中节点 / 256 名字长度）
 * [POS]: bundle 资料库纵深的**领域服务唯一真源**（方案 §4.4「C. 服务」组的口径）：所有公开方法在同一实例内**串行**（勘误 B4：并发串行**仅进程内**，跨进程 last-write-wins），读是同步内存读、写排在同一实例的队列上；list 顺序**不保证**（官方 json 后端是 `readdir` 序）⇒ **排序一律由本层做**。本文件仍然只依赖注入进来的两个端口（域 + 对象层），**不 import 任何 `@deepseek-ai/*`**；宿主接线在 `./host.ts`（存储服务面 / 路由 / 工具 / 注入），路由与工具只消费本门面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { LibraryError, badRequest, libraryError } from './errors.js'
import type { LibraryConversionRecord, LibraryObjectStorePort } from './objects.js'
import {
  LIBRARY_ASSET_KINDS,
  LIBRARY_DEFAULT_EXTENSIONS,
  LIBRARY_DEFAULT_MEDIA_TYPES,
  LIBRARY_DOMAIN_VERSION,
  LIBRARY_MAX_SELECTION_NODES,
  LIBRARY_ROOT_TITLE,
  parseLibraryRecord,
} from './storage/domain.js'
import type {
  LibraryAssetRecord,
  LibraryDomainPort,
  LibraryNodeRecord,
  LibraryRevisionRecord,
  LibrarySelectionRecord,
  LibraryTablePort,
} from './storage/domain.js'
import { isLibraryKeySafe, libraryRecordKey } from './storage/keys.js'
import {
  LIBRARY_SEARCH_LIMIT,
  compareLibrarySearchHits,
  librarySearchExcerpt,
  librarySearchLocation,
  librarySearchMatch,
  librarySearchTerm,
  type LibrarySearchHit,
} from './search.js'

export type { LibrarySearchHit } from './search.js'

/** 资产格式联合。 */
export type LibraryAssetKind = (typeof LIBRARY_ASSET_KINDS)[number]
/** 资产状态。 */
export type LibraryAssetStatus = 'active' | 'disabled'
/** 资产来源（`upload` 员工上传 / `task` 会话交付物 / `created` 工具直接创建）。 */
export type LibraryAssetSource = 'upload' | 'task' | 'created'

/** 会生成 id 的三类实体（每条记录的 id 都带固定前缀，便于人眼在磁盘清单里认出来）。 */
export type LibraryIdKind = 'node' | 'asset' | 'revision'

/** 各实体的 id 前缀。 */
const LIBRARY_ID_PREFIXES: Readonly<Record<LibraryIdKind, string>> = {
  node: 'nd',
  asset: 'as',
  revision: 'rv',
}

/**
 * 主体（"这份资料属于谁"）。
 *
 * 方案 §2.3 定的主体来源是「当前企业登录主体」，本刀只接收它、不解析它：
 * `scope` 本刀固定 `'personal'`（P2 加组织共享时放宽成联合类型，主键形状不变——§7 R14 要求 P0 就预留）。
 */
export interface LibrarySubject {
  readonly scope: 'personal'
  readonly ownerId: string
}

/** 容量与门禁上限（可注入，测试才能用很小的配额去撞真实分支）。 */
export interface LibraryLimits {
  /** 单主体已存原件字节上限（A26:16 的"单主体 5 GiB"）。 */
  readonly maxSubjectBytes: number
  /** 单会话选中节点上限（A26:182 / §4.4 C9 的 32）。 */
  readonly maxSelectionNodes: number
  /** 展示名长度上限（A26:27-31 的 `cleanName`）。 */
  readonly maxNameLength: number
}

/** 默认上限（逐个注明来源，改动必须同步注释）。 */
export const LIBRARY_DEFAULT_LIMITS: LibraryLimits = {
  maxSubjectBytes: 5 * 1024 * 1024 * 1024,
  maxSelectionNodes: LIBRARY_MAX_SELECTION_NODES,
  maxNameLength: 256,
}

/** 服务构造参数：**存储与对象层都必须注入**，模块顶层不 import 任何宿主单例。 */
export interface LibraryManagerOptions {
  /** 域句柄（官方 `Domain<typeof libraryDomainSpec>` 或测试假实现）。 */
  readonly domain: LibraryDomainPort
  /** 对象层（`LibraryObjectStore` 实例，根由它的构造参数 `dshHome` 决定）。 */
  readonly objects: LibraryObjectStorePort
  /** 主体。 */
  readonly subject: LibrarySubject
  /** 时钟（测试用固定时钟；默认 `() => new Date()`）。 */
  readonly now?: (() => Date) | undefined
  /** id 分配器（测试用确定性 id；默认 `<前缀>_<uuid>`）。 */
  readonly newId?: ((kind: LibraryIdKind) => string) | undefined
  /** 上限覆盖（默认见 `LIBRARY_DEFAULT_LIMITS`）。 */
  readonly limits?: Partial<LibraryLimits> | undefined
  /** 需要留痕的软失败（对象垃圾清理失败等）；不传就静默丢弃——**绝不因此让主流程失败**。 */
  readonly onError?: ((message: string, error: unknown) => void) | undefined
}

/** `createFolder` 入参。 */
export interface LibraryCreateFolderInput {
  readonly title: string
  /** 父节点；`null`/不传 = 挂在隐式根（`LIBRARY_ROOT_TITLE`）下。 */
  readonly parentId?: string | null | undefined
}

/** `createAsset` 入参：会同时建一个 `kind:'asset'` 的树节点。 */
export interface LibraryCreateAssetInput {
  readonly name: string
  readonly kind: LibraryAssetKind
  readonly parentId?: string | null | undefined
  /** 不传按 `kind` 取默认媒体类型。 */
  readonly mediaType?: string | undefined
  readonly source?: LibraryAssetSource | undefined
}

/** `writeRevision` 入参（原件 + 派生正文 + 可选转换元数据）。 */
export interface LibraryWriteRevisionInput {
  readonly assetId: string
  readonly original: Uint8Array
  readonly content: string
  /** 不传按资产 `kind` 取默认扩展名（`markdown`→`md`、`text`→`txt`…）。 */
  readonly extension?: string | undefined
  readonly conversion?: LibraryConversionRecord | undefined
}

/** 级联删除的结果计数（给路由返回与测试断言用）。 */
export interface LibraryRemovalSummary {
  readonly nodes: number
  readonly assets: number
  readonly revisions: number
}

/** `readRevisionText` 的返回值：修订元数据 + 正文。 */
export interface LibraryRevisionDocument {
  readonly revision: LibraryRevisionRecord
  readonly text: string
  readonly byteLength: number
}

/** `readRevisionOriginal` 的返回值：修订元数据 + 原件字节。 */
export interface LibraryRevisionOriginalContent {
  readonly revision: LibraryRevisionRecord
  readonly bytes: Buffer
  readonly byteLength: number
  readonly sha256: string
}

/**
 * `search` 入参（§4.1 F5/F12）。
 *
 * `sessionId` 是本刀最要紧的一件：**给了它就在"该会话已选中的资料"范围内检索**（方案 §4.4 E3：
 * 工具只准看本轮已选集合，这是把提示词注入面收窄的那道闸）；不给＝全库检索（页面里的查找走这条）。
 * `kind`/`source` 是 F5 的四类过滤里的两类（另两类是"停用跳过"与"只搜当前修订"，它们恒生效、不做成开关）。
 */
export interface LibrarySearchInput {
  /** 查询词；空串是合法的（＝把当前修订按最近排序列出来，分数恒 0）。 */
  readonly query: string
  readonly kind?: LibraryAssetKind | undefined
  readonly source?: LibraryAssetSource | undefined
  /** 给了就只在**该会话已选中**的资料范围内检索（F12 的精确修订匹配）。 */
  readonly sessionId?: string | undefined
  /** 返回上限；默认 `LIBRARY_SEARCH_LIMIT`（50）。 */
  readonly limit?: number | undefined
}

/** 选中集合里的一条（`assetId → revisionId` 的物化，给路由/工具与注入共用）。 */
export interface LibrarySelectionItem {
  /** 被选中的树节点 id（选择记录里存的是节点，这里保留原始身份）。 */
  readonly nodeId: string
  readonly assetId: string
  readonly revisionId: string
  readonly name: string
  readonly kind: LibraryAssetKind
}

/** 四张表记录共有的归属三件套（`scope`/`ownerId`/`id` 的**原始**值，是主键归属校验的真源）。 */
interface LibraryOwnedRecord {
  readonly scope: string
  readonly ownerId: string
  readonly id: string
}

/**
 * 资料库领域服务。一个实例 = 一个主体 + 一个已打开的域 + 一个对象层根。
 *
 * **并发语义（勘误 B4，必须按这个口径说话）**
 * · **进程内串行**：所有公开方法都排进本实例的 `chain`，一个方法的多步写（写对象文件 → 落修订记录 → 更新资产）
 *   不会被另一个方法从中间插进来；官方域后端自己的写链再保证单条记录的 `put/update/delete` 互不交错。
 * · **跨进程 last-write-wins**：官方 json 后端**没有文件锁**，GUI 与 CLI 同时写同一记录时以最后落盘者为准。
 *   本层不做任何跨进程协调（也不假装能做）。
 *
 * **list 顺序**：官方后端的 `keys()`/`entries()` 是 `readdir` 序（"顺序不保证"），所以每个 list 方法都在
 * 本层重新排序：节点 = 文件夹先、再 `title.localeCompare(…, 'zh-CN')`（§4.4 C6）；资产 = 名字同法；
 * 修订 = `number` 升序。调用方不许依赖存储序。
 */
export class LibraryManager {
  private readonly domain: LibraryDomainPort
  private readonly objects: LibraryObjectStorePort
  private readonly subject: LibrarySubject
  private readonly now: () => Date
  private readonly newId: (kind: LibraryIdKind) => string
  private readonly limits: LibraryLimits
  private readonly onError: ((message: string, error: unknown) => void) | undefined
  private readonly nodes: LibraryTablePort<LibraryNodeRecord>
  private readonly assets: LibraryTablePort<LibraryAssetRecord>
  private readonly revisions: LibraryTablePort<LibraryRevisionRecord>
  private readonly selections: LibraryTablePort<LibrarySelectionRecord>
  /** 本实例的写队列（**仅进程内**）；任何公开方法都必须经 `enqueue`。 */
  private chain: Promise<unknown> = Promise.resolve()

  constructor(options: LibraryManagerOptions) {
    if (options?.domain === undefined || options.domain === null) throw badRequest('library manager needs a domain')
    if (options.objects === undefined || options.objects === null) throw badRequest('library manager needs an object store')
    this.subject = {
      scope: 'personal',
      ownerId: requireText(options.subject?.ownerId, 'subject.ownerId'),
    }
    this.domain = options.domain
    this.objects = options.objects
    this.now = options.now ?? (() => new Date())
    this.newId = options.newId ?? (kind => `${LIBRARY_ID_PREFIXES[kind]}_${randomUUID()}`)
    this.limits = { ...LIBRARY_DEFAULT_LIMITS, ...(options.limits ?? {}) }
    this.onError = options.onError
    // 域句柄在构造期解析一次（官方 `Domain.table()` 返回稳定句柄），后续所有读写都走这四个。
    this.nodes = options.domain.table('nodes')
    this.assets = options.domain.table('assets')
    this.revisions = options.domain.table('revisions')
    this.selections = options.domain.table('selections')
    // 构造期就把主体压成一条可用键：主体 id 不合法（空串 / 全非法字符）在这里就炸，而不是等第一次落盘。
    if (!isLibraryKeySafe(this.keyOf('probe'))) {
      throw new LibraryError('library/invalid-key', 'library subject does not produce a safe record key')
    }
  }

  // ───────────────────────────── 节点（目录树） ─────────────────────────────

  /**
   * 建一个文件夹（隐式根下或某个文件夹下）。
   *
   * 顺序即复用的三条既有语义：`cleanName`（§4.4 C3）→ `assertFolder`（C4）→ `assertUniqueName`（C2，大小写不敏感）。
   */
  async createFolder(input: LibraryCreateFolderInput): Promise<LibraryNodeRecord> {
    return await this.enqueue(async () => {
      const title = this.cleanName(input?.title, 'title')
      const parentId = await this.assertFolder(input?.parentId ?? null)
      await this.assertUniqueName(parentId, title)
      const id = this.allocateId('node')
      this.assertKeyFree(this.nodes, id)
      const now = this.timestamp()
      const record = parseLibraryRecord('nodes', {
        schemaVersion: LIBRARY_DOMAIN_VERSION,
        scope: this.subject.scope,
        ownerId: this.subject.ownerId,
        id,
        parentId,
        kind: 'folder',
        title,
        depth: this.depthOf(parentId),
        assetId: null,
        createdAt: now,
        updatedAt: now,
      })
      await this.nodes.put(this.keyOf(id), record)
      return record
    })
  }

  /** 读一个节点；不存在（或属于别的主体，§4.4 A8）⇒ `library/not-found`。 */
  async getNode(nodeId: string): Promise<LibraryNodeRecord> {
    return await this.enqueue(async () => this.requireOwned(this.nodes, nodeId, 'node'))
  }

  /** 列某个父节点下的**直接子节点**（默认隐式根）；父不存在 ⇒ `library/not-found`（不是空列表）。 */
  async listNodes(parentId: string | null = null): Promise<readonly LibraryNodeRecord[]> {
    return await this.enqueue(async () => {
      const target = parentId === null ? null : requireText(parentId, 'parentId')
      if (target !== null) this.requireOwned(this.nodes, target, 'node')
      return sortNodes(this.ownedNodes().filter(node => node.parentId === target))
    })
  }

  /** 列本主体的**全部**节点（目录树整树渲染用）；排序同 `listNodes`。 */
  async listAllNodes(): Promise<readonly LibraryNodeRecord[]> {
    return await this.enqueue(async () => sortNodes(this.ownedNodes()))
  }

  /**
   * 改名（同一父下仍要过重名门禁，排除自己）。
   *
   * **文件节点要同步两处展示名**：树上的 `nodes.title` 与资产上的 `assets.name`（`storage/domain.ts` 明写
   * "避免展示名两个真源"——不同步的话，检索命中与工具输出会拿着旧名字说话）。两处写不在同一张表上、
   * 无法原子，故第二处失败时把第一处回滚回去，宁可"什么都没改"也不留两个名字。
   */
  async renameNode(nodeId: string, title: string): Promise<LibraryNodeRecord> {
    return await this.enqueue(async () => {
      const node = this.requireOwned(this.nodes, nodeId, 'node')
      const cleaned = this.cleanName(title, 'title')
      await this.assertUniqueName(node.parentId, cleaned, node.id)
      const now = this.timestamp()
      const renamed = await this.nodes.update(this.keyOf(node.id), current =>
        parseLibraryRecord('nodes', { ...current, title: cleaned, updatedAt: now }))
      if (node.kind === 'asset' && node.assetId !== null
        && this.ownedOrUndefined(this.assets, node.assetId) !== undefined) {
        try {
          await this.assets.update(this.keyOf(node.assetId), current =>
            parseLibraryRecord('assets', { ...current, name: cleaned, updatedAt: now }))
        } catch (error) {
          await this.nodes.update(this.keyOf(node.id), current =>
            parseLibraryRecord('nodes', { ...current, title: node.title, updatedAt: node.updatedAt }))
            .catch(cleanupError => this.report('library rename rollback failed', cleanupError))
          throw error
        }
      }
      return renamed
    })
  }

  /**
   * 移动节点（`parentId = null` 表示移到隐式根下）。
   *
   * 两条门禁：目标父必须是文件夹（C4）；**移到自己的后代下会成环 ⇒ `library/cycle`**（C5）。
   * 移动会连带重算整棵子树的 `depth`（`depth` 是物化字段，不重算就会撒谎）。
   */
  async moveNode(nodeId: string, parentId: string | null): Promise<LibraryNodeRecord> {
    return await this.enqueue(async () => {
      const node = this.requireOwned(this.nodes, nodeId, 'node')
      const target = await this.assertFolder(parentId)
      if (target !== null && (target === node.id || this.isDescendantOf(target, node.id))) {
        throw new LibraryError('library/cycle', 'library node cannot be moved below itself')
      }
      if (target === node.parentId) return node // 目标就是当前父：幂等返回，不写盘
      const now = this.timestamp()
      const moved = await this.nodes.update(this.keyOf(node.id), current =>
        parseLibraryRecord('nodes', { ...current, parentId: target, depth: this.depthOf(target), updatedAt: now }))
      await this.recomputeSubtreeDepths(moved)
      return moved
    })
  }

  /**
   * 删除节点及其整棵子树（§4.4 C11）：子节点递归、文件节点的资产与**全部修订**（记录 + 对象目录）一起删，
   * 最后把被删节点从本主体所有会话选择里剔掉（选择为空则整条删掉，不留空记录）。
   */
  async removeNode(nodeId: string): Promise<LibraryRemovalSummary> {
    return await this.enqueue(async () => await this.removeNodeInternal(requireText(nodeId, 'nodeId')))
  }

  // ───────────────────────────── 资产 ─────────────────────────────

  /**
   * 建一份资料：同时落两条记录——`assets`（内容身份）与一个 `kind:'asset'` 的 `nodes`（树位置）。
   *
   * 两条记录**不能**原子落盘（官方每张表各自一条写链），所以先落资产、后落节点，节点落盘失败就补偿删掉资产：
   * 失败的中间态落在"看不见的孤儿资产"这一侧（可被后续 GC），而不是"看见的坏节点"这一侧。
   * 真正的端到端幂等/原子语义由上层 `operationId` 回执承担（§4.4 C1/F9）。
   */
  async createAsset(input: LibraryCreateAssetInput): Promise<LibraryAssetRecord> {
    return await this.enqueue(async () => {
      const name = this.cleanName(input?.name, 'name')
      if (typeof input?.kind !== 'string' || !(LIBRARY_ASSET_KINDS as readonly string[]).includes(input.kind)) {
        throw badRequest(`asset kind must be one of ${LIBRARY_ASSET_KINDS.join(', ')}`)
      }
      const kind: LibraryAssetKind = input.kind
      const parentId = await this.assertFolder(input?.parentId ?? null)
      await this.assertUniqueName(parentId, name)
      const mediaType = input.mediaType === undefined
        ? LIBRARY_DEFAULT_MEDIA_TYPES[kind]
        : requireMediaType(input.mediaType)
      const source = input.source ?? 'upload'
      const now = this.timestamp()
      const assetId = this.allocateId('asset')
      const nodeId = this.allocateId('node')
      this.assertKeyFree(this.assets, assetId)
      this.assertKeyFree(this.nodes, nodeId)
      const asset = parseLibraryRecord('assets', {
        schemaVersion: LIBRARY_DOMAIN_VERSION,
        scope: this.subject.scope,
        ownerId: this.subject.ownerId,
        id: assetId,
        nodeId,
        name,
        kind,
        mediaType,
        byteLength: 0,
        currentRevisionId: null,
        status: 'active',
        source,
        createdAt: now,
        updatedAt: now,
      })
      const node = parseLibraryRecord('nodes', {
        schemaVersion: LIBRARY_DOMAIN_VERSION,
        scope: this.subject.scope,
        ownerId: this.subject.ownerId,
        id: nodeId,
        parentId,
        kind: 'asset',
        title: name,
        depth: this.depthOf(parentId),
        assetId,
        createdAt: now,
        updatedAt: now,
      })
      await this.assets.put(this.keyOf(assetId), asset)
      try {
        await this.nodes.put(this.keyOf(nodeId), node)
      } catch (error) {
        // 补偿：把刚落的资产记录撤掉（对象层此刻还没有任何字节），再把失败收敛成稳定码。
        await this.assets.delete(this.keyOf(assetId)).catch(cleanupError => this.report('library orphan asset cleanup failed', cleanupError))
        throw libraryError(error, 'library/internal', 'library asset node could not be recorded')
      }
      return asset
    })
  }

  /** 读一份资产；不存在（或属于别的主体）⇒ `library/not-found`。 */
  async getAsset(assetId: string): Promise<LibraryAssetRecord> {
    return await this.enqueue(async () => this.requireOwned(this.assets, assetId, 'asset'))
  }

  /** 列本主体的全部资产（名字升序，`zh-CN` 排序规则）。 */
  async listAssets(): Promise<readonly LibraryAssetRecord[]> {
    return await this.enqueue(async () => sortAssets(this.ownedAssets()))
  }

  /** 启用/停用一份资产（`disabled` 的资产不会进会话选择，§4.4 C9）。 */
  async setAssetStatus(assetId: string, status: LibraryAssetStatus): Promise<LibraryAssetRecord> {
    return await this.enqueue(async () => {
      if (status !== 'active' && status !== 'disabled') throw badRequest('asset status must be active or disabled')
      const asset = this.requireOwned(this.assets, assetId, 'asset')
      const now = this.timestamp()
      return await this.assets.update(this.keyOf(asset.id), current =>
        parseLibraryRecord('assets', { ...current, status, updatedAt: now }))
    })
  }

  /**
   * 按资产 id 删除：等价于删掉拥有它的那个树节点（级联到全部修订记录 + 对象目录）。
   * 节点已经不在（不一致态）时退化为"只清资产与修订"，同样不留孤儿记录。
   */
  async removeAsset(assetId: string): Promise<LibraryRemovalSummary> {
    return await this.enqueue(async () => {
      const asset = this.requireOwned(this.assets, assetId, 'asset')
      const node = this.ownedOrUndefined(this.nodes, asset.nodeId)
      if (node !== undefined) return await this.removeNodeInternal(node.id)
      const revisions = await this.removeAssetRecords(asset)
      return { nodes: 0, assets: 1, revisions }
    })
  }

  // ───────────────────────────── 修订（不可变原件） ─────────────────────────────

  /**
   * 写一条**新**修订：对象层原子落盘（原件 + 正文 + 可选 conversion）+ 落 `revisions` 记录 + 更新资产指针。
   *
   * 步骤与补偿：写对象 → 落记录 → `update` 资产指针。第三步失败 ⇒ 删掉刚落的记录再抛；
   * 第一/二步失败 ⇒ 删掉刚写的对象目录（`removeRevisionObjects`）再抛。**任何失败都不留孤儿**。
   * 上限先在服务层判一遍（fail fast，不写半个字节），对象层内部还会再判一遍（防御性重复）。
   */
  async writeRevision(input: LibraryWriteRevisionInput): Promise<LibraryRevisionRecord> {
    return await this.enqueue(async () => {
      const asset = this.requireOwned(this.assets, input?.assetId, 'asset')
      const original = requireBytes(input?.original, 'original')
      const content = requireContent(input?.content, 'content')
      const extension = input.extension === undefined
        ? LIBRARY_DEFAULT_EXTENSIONS[asset.kind]
        : requireExtension(input.extension)
      await this.assertQuota(original.byteLength)
      const revisionId = this.allocateId('revision')
      this.assertKeyFree(this.revisions, revisionId)
      const number = this.nextRevisionNumber(asset.id)
      const now = this.timestamp()
      const objects = await this.objects.writeRevision({
        assetId: asset.id,
        revisionId,
        extension,
        original,
        content,
        conversion: input.conversion,
      })
      try {
        const record = parseLibraryRecord('revisions', {
          schemaVersion: LIBRARY_DOMAIN_VERSION,
          scope: this.subject.scope,
          ownerId: this.subject.ownerId,
          id: revisionId,
          assetId: asset.id,
          number,
          originalSha256: objects.originalSha256,
          originalByteLength: objects.originalByteLength,
          originalRelativePath: objects.originalRelativePath,
          contentSha256: objects.contentSha256,
          contentByteLength: objects.contentByteLength,
          contentRelativePath: objects.contentRelativePath,
          conversionStatus: objects.conversionWritten ? 'ready' : 'pending',
          conversionWarnings: input.conversion?.warnings ?? [],
          createdAt: now,
        })
        await this.revisions.put(this.keyOf(revisionId), record)
        try {
          await this.assets.update(this.keyOf(asset.id), current => parseLibraryRecord('assets', {
            ...current,
            currentRevisionId: revisionId,
            byteLength: objects.originalByteLength,
            updatedAt: now,
          }))
        } catch (error) {
          // 补偿：资产指针没更新成功 ⇒ 撤掉刚落的修订记录，回到"这次修订从未发生"。
          await this.revisions.delete(this.keyOf(revisionId)).catch(cleanupError => this.report('library orphan revision record cleanup failed', cleanupError))
          throw error
        }
        return record
      } catch (error) {
        // 补偿：对象目录撤掉（`removeRevisionObjects` 自带路径门禁），不留半成品目录。
        await this.objects.removeRevisionObjects(asset.id, revisionId)
          .catch(cleanupError => this.report('library orphan revision objects cleanup failed', cleanupError))
        throw libraryError(error, 'library/internal', 'library revision could not be recorded')
      }
    })
  }

  /** 读一条修订记录；不属于该资产时按 `library/not-found`（不泄漏"存在但不对"这件事实）。 */
  async getRevision(assetId: string, revisionId: string): Promise<LibraryRevisionRecord> {
    return await this.enqueue(async () => this.requireRevisionOf(assetId, revisionId))
  }

  /** 列一份资产的全部修订，按 `number` 升序（第 1 版在前）。 */
  async listRevisions(assetId: string): Promise<readonly LibraryRevisionRecord[]> {
    return await this.enqueue(async () => {
      const asset = this.requireOwned(this.assets, assetId, 'asset')
      return this.ownedRevisions()
        .filter(revision => revision.assetId === asset.id)
        .sort((a, b) => a.number - b.number)
    })
  }

  /**
   * 检索（§4.1 F5 的逐条口径 + F12 的"给了 sessionId 就只看已选集合" + F13 的"停用即隔离"）。
   *
   * 语义全部委托给 `./search.js` 的纯函数（三档分数 / 排序 / 摘录窗口 / 位置标题），本方法只负责：
   * ① 过滤（停用跳过、kind/source、只搜**当前修订**）；② 把正文从对象层读出来；③ 组装命中并截断。
   *
   * 三条边界：
   * · **给了 `sessionId` 但该会话没有任何选择记录 ⇒ 没有任何命中**（不是"整库"——F12 的方向是收窄，不是放宽）；
   * · 正文读不出来（对象缺失 / 转换失败）时，**空查询**仍列出该修订（摘录为空，F19 的"空查询仍能在最近看到"），
   *   非空查询则跳过——两种情况都经 `onError` 留痕，绝不静默吞掉；
   * · 结果顺序由 `compareLibrarySearchHits` 唯一决定（后端序不许泄漏到界面）。
   */
  async search(input: LibrarySearchInput): Promise<readonly LibrarySearchHit[]> {
    return await this.enqueue(async () => {
      const raw = input?.query
      if (typeof raw !== 'string') throw badRequest('query must be a string')
      if (raw.includes('\u0000')) throw badRequest('query must not contain a NUL byte')
      const term = librarySearchTerm(raw)
      const kind = input.kind === undefined ? undefined : requireAssetKind(input.kind)
      const source = input.source === undefined ? undefined : requireAssetSource(input.source)
      const limit = input.limit === undefined ? LIBRARY_SEARCH_LIMIT : requireSearchLimit(input.limit)
      const selected = input.sessionId === undefined
        ? undefined
        : await this.selectedRevisionMap(requireText(input.sessionId, 'sessionId'))
      if (selected !== undefined && selected.size === 0) return []
      const hits: LibrarySearchHit[] = []
      for (const asset of this.ownedAssets()) {
        if (asset.status === 'disabled') continue
        if (kind !== undefined && asset.kind !== kind) continue
        if (source !== undefined && asset.source !== source) continue
        const revisionId = asset.currentRevisionId
        if (revisionId === null) continue
        if (selected !== undefined && selected.get(asset.id) !== revisionId) continue
        const revision = this.ownedOrUndefined(this.revisions, revisionId)
        if (revision === undefined || revision.assetId !== asset.id) continue
        let text: string
        try {
          text = (await this.objects.readRevisionText(asset.id, revision.id)).text
        } catch (error) {
          this.report('library search could not read one revision text', error)
          if (term.length > 0) continue
          text = ''
        }
        const match = librarySearchMatch(term, asset.name, text)
        if (match === undefined) continue
        const location = librarySearchLocation(text, match.offset)
        hits.push({
          assetId: asset.id,
          revisionId: revision.id,
          name: asset.name,
          kind: asset.kind,
          source: asset.source,
          updatedAt: asset.updatedAt,
          folderPath: this.folderPathOf(nodeIdOfAsset(this.ownedNodes(), asset.id)),
          score: match.score,
          ...(location === undefined ? {} : { location }),
          excerpt: librarySearchExcerpt(text, match.offset),
        })
      }
      return hits.sort(compareLibrarySearchHits).slice(0, limit)
    })
  }

  /**
   * 读一条修订的**派生正文**（`content.md`）；对象缺失 ⇒ `library/object-missing`。
   *
   * **停用即隔离**（§4.4 F13）：资产 `status:'disabled'` 时读正文一律拒 `library/disabled`——
   * 停用的语义是"模型不能消费它"，而读正文正是消费的入口（原件仍可读：那是员工自己的文件，
   * 与 F19 的"转换失败仍保留原件"同一条口径）。
   */
  async readRevisionText(assetId: string, revisionId: string): Promise<LibraryRevisionDocument> {
    return await this.enqueue(async () => {
      const revision = this.requireRevisionOf(assetId, revisionId)
      const asset = this.ownedOrUndefined(this.assets, revision.assetId)
      if (asset !== undefined && asset.status === 'disabled') {
        throw new LibraryError('library/disabled', 'library revision text is not readable while the asset is disabled')
      }
      const { text, byteLength } = await this.objects.readRevisionText(revision.assetId, revision.id)
      return { revision, text, byteLength }
    })
  }

  /** 读一条修订的**原件字节**（`original.<ext>`，扩展名由对象层记录里的相对路径推出）。 */
  async readRevisionOriginal(assetId: string, revisionId: string): Promise<LibraryRevisionOriginalContent> {
    return await this.enqueue(async () => {
      const revision = this.requireRevisionOf(assetId, revisionId)
      const filename = revision.originalRelativePath.split('/').pop() ?? ''
      const extension = filename.startsWith('original.') ? filename.slice('original.'.length) : ''
      if (extension.length === 0) {
        throw new LibraryError('library/invalid-record', 'library revision original path has no extension')
      }
      const { bytes, byteLength, sha256 } = await this.objects.readRevisionOriginal(revision.assetId, revision.id, extension)
      return { revision, bytes, byteLength, sha256 }
    })
  }

  /** 读一条修订的转换元数据；`conversion.json` 还没写 ⇒ `undefined`（未转换是合法态）。 */
  async readRevisionConversion(assetId: string, revisionId: string): Promise<LibraryConversionRecord | undefined> {
    return await this.enqueue(async () => {
      const revision = this.requireRevisionOf(assetId, revisionId)
      return await this.objects.readRevisionConversion(revision.assetId, revision.id)
    })
  }

  // ───────────────────────────── 会话选择 ─────────────────────────────

  /**
   * 覆盖式设置某个会话的选中集合（主键 = sessionId，与 A30 的 `reference` 口径一致）。
   *
   * 门禁：数量 ≤ `maxSelectionNodes`（§4.4 C9，超了 `library/selection-too-large`）；
   * 每个 nodeId 必须存在；**停用资产会被跳过**（C9）；重复 id 去重保序。
   */
  async setSelection(sessionId: string, nodeIds: readonly string[]): Promise<LibrarySelectionRecord> {
    return await this.enqueue(async () => {
      const id = requireText(sessionId, 'sessionId')
      if (!Array.isArray(nodeIds)) throw badRequest('nodeIds must be an array')
      if (nodeIds.length > this.limits.maxSelectionNodes) {
        throw new LibraryError('library/selection-too-large', `library selection exceeds ${this.limits.maxSelectionNodes} nodes`)
      }
      const kept: string[] = []
      for (const candidate of nodeIds) {
        const node = this.requireOwned(this.nodes, candidate, 'node')
        if (node.kind === 'asset' && node.assetId !== null) {
          const asset = this.ownedOrUndefined(this.assets, node.assetId)
          if (asset !== undefined && asset.status === 'disabled') continue
        }
        if (!kept.includes(node.id)) kept.push(node.id)
      }
      const record = parseLibraryRecord('selections', {
        schemaVersion: LIBRARY_DOMAIN_VERSION,
        scope: this.subject.scope,
        ownerId: this.subject.ownerId,
        id,
        sessionId: id,
        nodeIds: kept,
        updatedAt: this.timestamp(),
      })
      await this.selections.put(this.keyOf(id), record)
      return record
    })
  }

  /** 读某个会话的选中集合；从未设置过 ⇒ `undefined`（"还没选"是合法态，不是错误）。 */
  async getSelection(sessionId: string): Promise<LibrarySelectionRecord | undefined> {
    return await this.enqueue(async () => this.ownedOrUndefined(this.selections, requireText(sessionId, 'sessionId')))
  }

  /** 清掉某个会话的选中集合；返回它此前是否存在。 */
  async clearSelection(sessionId: string): Promise<boolean> {
    return await this.enqueue(async () => await this.selections.delete(this.keyOf(requireText(sessionId, 'sessionId'))))
  }

  /**
   * 把某个会话的选中集合物化成 `assetId → revisionId`（F12 的"精确修订匹配"由此而来）。
   *
   * 三条收敛（与 F13/C9 一致，且都在**读**这一侧再判一次，不依赖写时的那道）：节点必须还在、
   * 必须是文件节点、资产必须还活着且**未停用**、必须有当前修订。任何一条不满足 ⇒ 那一份就从集合里消失
   * （而不是留下一个"选中了但读不出来"的悬空 id）。
   */
  async selectedRevisions(sessionId: string): Promise<ReadonlyMap<string, string>> {
    return await this.enqueue(async () => await this.selectedRevisionMap(requireText(sessionId, 'sessionId')))
  }

  /** 同上的物化清单（路由的 `task-selection` 与注入共用；顺序＝选择记录里的顺序）。 */
  async selectedItems(sessionId: string): Promise<readonly LibrarySelectionItem[]> {
    return await this.enqueue(async () => await this.selectedItemsOrEmpty(requireText(sessionId, 'sessionId')))
  }

  /**
   * 一个树节点所在文件夹的**可读路径**（`我的资料 / 项目甲`；直接在根下就是 `我的资料`）。
   *
   * 纯展示用途（命中列表与工具输出），因此**不抛**：节点未知/链上有环一律停在能走到的那一段——
   * 检索不该因为一条坏记录整条失败，但它也绝不说假话（只报真的走过的祖先标题）。
   */
  folderPathOf(nodeId: string | null): string {
    const chain: string[] = []
    const seen = new Set<string>()
    let cursor = nodeId === null ? null : this.ownedOrUndefined(this.nodes, nodeId)?.parentId ?? null
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor)
      const node = this.ownedOrUndefined(this.nodes, cursor)
      if (node === undefined) break
      if (node.kind === 'folder') chain.unshift(node.title)
      cursor = node.parentId
    }
    return [LIBRARY_ROOT_TITLE, ...chain].join(' / ')
  }

  /** `selectedRevisions` / `selectedItems` 共用的物化内核（**不**自己入队，调用方已在队列上）。 */
  private async selectedRevisionMap(sessionId: string): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    for (const item of await this.selectedItemsOrEmpty(sessionId)) map.set(item.assetId, item.revisionId)
    return map
  }

  /** 同上，但读的是"选择记录 → 条目"那一段（抽出来避免 `selectedRevisionMap` 再入队一次）。 */
  private async selectedItemsOrEmpty(sessionId: string): Promise<readonly LibrarySelectionItem[]> {
    const selection = this.ownedOrUndefined(this.selections, sessionId)
    if (selection === undefined) return []
    const items: LibrarySelectionItem[] = []
    for (const nodeId of selection.nodeIds) {
      const node = this.ownedOrUndefined(this.nodes, nodeId)
      if (node === undefined || node.kind !== 'asset' || node.assetId === null) continue
      const asset = this.ownedOrUndefined(this.assets, node.assetId)
      if (asset === undefined || asset.status === 'disabled' || asset.currentRevisionId === null) continue
      items.push({
        nodeId: node.id,
        assetId: asset.id,
        revisionId: asset.currentRevisionId,
        name: asset.name,
        kind: asset.kind,
      })
    }
    return items
  }

  // ───────────────────────────── 内部：串行与记录访问 ─────────────────────────────

  /** 把任务排进本实例的队列（失败也不让链断掉：前一环的失败必须原样抛给**它的**调用方）。 */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task)
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }

  /** 记录键：主体 + 记录自己的 id（原始值进记录、归一化后的值进键）。 */
  private keyOf(id: string): string {
    return libraryRecordKey({ scope: this.subject.scope, ownerId: this.subject.ownerId, id })
  }

  private timestamp(): string {
    return this.now().toISOString()
  }

  private allocateId(kind: LibraryIdKind): string {
    const id = this.newId(kind)
    // id 是**记录的真源**，必须非空、无控制字符，且拼出来的键要能过官方后端 —— 三条都在这里一次判掉。
    requireText(id, `${kind} id`)
    if (!isLibraryKeySafe(this.keyOf(id))) {
      throw new LibraryError('library/invalid-key', `allocated ${kind} id does not produce a safe record key`)
    }
    return id
  }

  /** 展示名门禁（§4.4 C3 的 `cleanName`：空/`.`/`..`/含 `/` `\`/控制字符/超长一律 `library/invalid-name`）。 */
  private cleanName(value: unknown, label: string): string {
    if (typeof value !== 'string') throw new LibraryError('library/invalid-name', `library ${label} must be a string`)
    const trimmed = value.trim()
    if (trimmed.length === 0) throw new LibraryError('library/invalid-name', `library ${label} must not be empty`)
    if (trimmed === '.' || trimmed === '..') throw new LibraryError('library/invalid-name', `library ${label} must not be a dot segment`)
    if (trimmed.length > this.limits.maxNameLength) {
      throw new LibraryError('library/invalid-name', `library ${label} exceeds ${this.limits.maxNameLength} characters`)
    }
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      throw new LibraryError('library/invalid-name', `library ${label} must not contain path separators`)
    }
    for (const character of trimmed) {
      const code = character.codePointAt(0) ?? 0
      if (code < 0x20 || code === 0x7f) {
        throw new LibraryError('library/invalid-name', `library ${label} must not contain control characters`)
      }
    }
    return trimmed
  }

  /** 归属校验后的同步读：键上的记录不存在、或三元组不是本主体 ⇒ `undefined`（§4.4 A8 主体隔离）。 */
  private ownedOrUndefined<V extends LibraryOwnedRecord>(handle: LibraryTablePort<V>, id: string): V | undefined {
    const record = handle.get(this.keyOf(requireText(id, 'id')))
    if (record === undefined) return undefined
    if (record.scope !== this.subject.scope || record.ownerId !== this.subject.ownerId || record.id !== id) {
      return undefined
    }
    return record
  }

  /** 同上，但不存在就抛 `library/not-found`。 */
  private requireOwned<V extends LibraryOwnedRecord>(handle: LibraryTablePort<V>, id: unknown, label: string): V {
    const record = this.ownedOrUndefined(handle, requireText(id, `${label} id`))
    if (record === undefined) throw new LibraryError('library/not-found', `library ${label} was not found`)
    return record
  }

  private ownedNodes(): LibraryNodeRecord[] {
    return this.ownedList(this.nodes)
  }

  private ownedAssets(): LibraryAssetRecord[] {
    return this.ownedList(this.assets)
  }

  private ownedRevisions(): LibraryRevisionRecord[] {
    return this.ownedList(this.revisions)
  }

  private ownedSelections(): LibrarySelectionRecord[] {
    return this.ownedList(this.selections)
  }

  /** 快照迭代 + 主体过滤（顺序是后端序，调用方必须自己排）。 */
  private ownedList<V extends LibraryOwnedRecord>(handle: LibraryTablePort<V>): V[] {
    const out: V[] = []
    for (const [, record] of handle.entries()) {
      if (record.scope === this.subject.scope && record.ownerId === this.subject.ownerId) out.push(record)
    }
    return out
  }

  /**
   * 建新记录前的键占用检查：该表里这个键**已被任何三元组占用**就拒（fail-closed，绝不覆盖、绝不静默串号）。
   *
   * 键只在**同一张表内**需要唯一（磁盘上是 `<域>/<表>/<key>.json`，四张表各自一个目录），
   * 所以这里按表查而不是四张表一起查。占用者可能是别的主体（键段里带了 ownerId，正常不会撞），
   * 也可能是本主体一个已存在的 id（id 分配器撞车）——两种都拒，语义都是"这个键已经被用了"。
   */
  private assertKeyFree<V>(handle: LibraryTablePort<V>, id: string): void {
    const key = this.keyOf(id)
    if (!isLibraryKeySafe(key)) throw new LibraryError('library/invalid-key', 'library record key is not path-safe')
    if (handle.get(key) !== undefined) {
      throw new LibraryError('library/key-collision', 'library record key is already occupied by another record')
    }
  }

  /** 父节点门禁（§4.4 C4）：`null` = 隐式根；否则必须存在且是文件夹，否则 `library/not-folder`。 */
  private async assertFolder(parentId: string | null): Promise<string | null> {
    if (parentId === null) return null
    const parent = this.requireOwned(this.nodes, parentId, 'parent node')
    if (parent.kind !== 'folder') {
      throw new LibraryError('library/not-folder', 'library parent node is not a folder')
    }
    return parent.id
  }

  /** 同父下大小写不敏感重名（§4.4 C2）；`excludeId` 用于改名/移动时排除自己。 */
  private async assertUniqueName(parentId: string | null, title: string, excludeId?: string): Promise<void> {
    const lowered = title.toLowerCase()
    for (const node of this.ownedNodes()) {
      if (node.parentId !== parentId || node.id === excludeId) continue
      if (node.title.toLowerCase() === lowered) {
        throw new LibraryError('library/name-conflict', 'library node name already exists below the same parent')
      }
    }
  }

  /** 父节点下的深度（隐式根 = 0，其子 = 1…）；父不存在时按 0 处理（调用方已 gate 过）。 */
  private depthOf(parentId: string | null): number {
    if (parentId === null) return 0
    const parent = this.ownedOrUndefined(this.nodes, parentId)
    return parent === undefined ? 0 : parent.depth + 1
  }

  /** 判断 `candidateId` 是不是 `ancestorId` 的后代（配合 C5 的环检测；顺带防住存量数据里已有的环）。 */
  private isDescendantOf(candidateId: string, ancestorId: string): boolean {
    const seen = new Set<string>()
    let cursor: string | null = candidateId
    while (cursor !== null) {
      if (cursor === ancestorId) return true
      if (seen.has(cursor)) return false // 存量数据已经有环：当作"不是后代"，避免死循环
      seen.add(cursor)
      const node: LibraryNodeRecord | undefined = this.ownedOrUndefined(this.nodes, cursor)
      if (node === undefined) return false
      cursor = node.parentId
    }
    return false
  }

  /** 移动之后重算整棵子树的物化 `depth`（自顶向下 BFS；节点数是资料量级，不做索引优化）。 */
  private async recomputeSubtreeDepths(root: LibraryNodeRecord): Promise<void> {
    const queue: LibraryNodeRecord[] = [root]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const child of this.ownedNodes().filter(node => node.parentId === current.id)) {
        const depth = current.depth + 1
        if (child.depth !== depth) {
          await this.nodes.update(this.keyOf(child.id), stored =>
            parseLibraryRecord('nodes', { ...stored, depth, updatedAt: this.timestamp() }))
        }
        queue.push({ ...child, depth })
      }
    }
  }

  /** 某资产下一版修订的编号（第 1 版 = 1；不做复用，删掉中间的版本也不回退）。 */
  private nextRevisionNumber(assetId: string): number {
    let max = 0
    for (const revision of this.ownedRevisions()) {
      if (revision.assetId === assetId && revision.number > max) max = revision.number
    }
    return max + 1
  }

  /** 读一条属于指定资产的修订（资产不存在也按 not-found）。 */
  private requireRevisionOf(assetId: string, revisionId: string): LibraryRevisionRecord {
    const asset = this.requireOwned(this.assets, assetId, 'asset')
    const revision = this.requireOwned(this.revisions, revisionId, 'revision')
    if (revision.assetId !== asset.id) throw new LibraryError('library/not-found', 'library revision was not found')
    return revision
  }

  /** 单主体容量门禁（§4.4 C12；口径是"已存原件字节之和 + 本次"）。 */
  private async assertQuota(incomingBytes: number): Promise<void> {
    let used = 0
    for (const revision of this.ownedRevisions()) used += revision.originalByteLength
    if (used + incomingBytes > this.limits.maxSubjectBytes) {
      throw new LibraryError('library/quota-exceeded', 'library subject storage quota exceeded')
    }
  }

  /** 递归收集子树（含自己）并按"资产 → 节点"的顺序清干净。 */
  private async removeNodeInternal(nodeId: string): Promise<LibraryRemovalSummary> {
    const root = this.requireOwned(this.nodes, nodeId, 'node')
    const collected: LibraryNodeRecord[] = []
    const queue: LibraryNodeRecord[] = [root]
    while (queue.length > 0) {
      const current = queue.shift()!
      collected.push(current)
      for (const child of this.ownedNodes()) if (child.parentId === current.id) queue.push(child)
    }
    let assets = 0
    let revisions = 0
    for (const node of collected) {
      if (node.assetId === null) continue
      const asset = this.ownedOrUndefined(this.assets, node.assetId)
      if (asset === undefined) continue
      revisions += await this.removeAssetRecords(asset)
      assets += 1
    }
    for (const node of collected) await this.nodes.delete(this.keyOf(node.id))
    await this.pruneSelections(new Set(collected.map(node => node.id)))
    return { nodes: collected.length, assets, revisions }
  }

  /**
   * 删一份资产的记录与对象目录：**先删记录、再尽力删对象**。
   *
   * 顺序理由：反过来的话，"对象删了、记录删失败"会留下**指向空对象的记录**（读它必报 `object-missing`，
   * 是员工可见的坏状态）；而现在的顺序最坏只留下一个**没有任何记录指向的目录**（不可见的垃圾，后续可 GC）。
   * 对象删除失败不阻断删除流程，只经 `onError` 留痕——记录才是真源。
   */
  private async removeAssetRecords(asset: LibraryAssetRecord): Promise<number> {
    const owned = this.ownedRevisions().filter(revision => revision.assetId === asset.id)
    for (const revision of owned) await this.revisions.delete(this.keyOf(revision.id))
    await this.assets.delete(this.keyOf(asset.id))
    for (const revision of owned) {
      await this.objects.removeRevisionObjects(asset.id, revision.id)
        .catch(error => this.report('library orphan revision objects could not be removed', error))
    }
    return owned.length
  }

  /** 把被删节点从所有会话选择里剔掉；选择变空 ⇒ 整条删掉（不留空记录）。 */
  private async pruneSelections(deletedNodeIds: ReadonlySet<string>): Promise<void> {
    for (const selection of this.ownedSelections()) {
      const kept = selection.nodeIds.filter(id => !deletedNodeIds.has(id))
      if (kept.length === selection.nodeIds.length) continue
      if (kept.length === 0) {
        await this.selections.delete(this.keyOf(selection.id))
        continue
      }
      await this.selections.put(this.keyOf(selection.id), parseLibraryRecord('selections', {
        ...selection,
        nodeIds: kept,
        updatedAt: this.timestamp(),
      }))
    }
  }

  private report(message: string, error: unknown): void {
    this.onError?.(message, error)
  }

  /**
   * 供**同级模块**（`import.ts` 的导入失败补偿、宿主接线层）走同一条留痕通道的公开入口。
   *
   * 为什么公开：`onError` 是构造期注入的唯一留痕面，同级模块不该为了记一句话再建第二个回调通道；
   * 它**只记不抛**，调用方必须继续抛原始失败（绝不用它掩盖错误）。
   */
  reportCleanupFailure(message: string, error: unknown): void {
    this.report(message, error)
  }
}

/** 节点排序：文件夹先，再按 `title` 的 `zh-CN` 规则（§4.4 C6）。 */
function sortNodes(nodes: readonly LibraryNodeRecord[]): LibraryNodeRecord[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

/** 资产排序：名字的 `zh-CN` 规则（存储序不许泄漏给界面）。 */
function sortAssets(assets: readonly LibraryAssetRecord[]): LibraryAssetRecord[] {
  return [...assets].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

/** 某份资产的树节点 id（`createAsset` 保证一对一；存量数据里缺失 ⇒ `null`，路径就停在根）。 */
function nodeIdOfAsset(nodes: readonly LibraryNodeRecord[], assetId: string): string | null {
  for (const node of nodes) {
    if (node.kind === 'asset' && node.assetId === assetId) return node.id
  }
  return null
}

/** 检索的 `kind` 过滤门禁：必须是本仓六种格式之一（别的值一律 400，不静默变成"不过滤"）。 */
function requireAssetKind(value: unknown): LibraryAssetKind {
  if (typeof value !== 'string' || !(LIBRARY_ASSET_KINDS as readonly string[]).includes(value)) {
    throw badRequest('kind must be one of the library asset kinds')
  }
  return value as LibraryAssetKind
}

/** 检索的 `source` 过滤门禁（同上：非法值 400，不静默忽略）。 */
function requireAssetSource(value: unknown): LibraryAssetSource {
  if (value !== 'upload' && value !== 'task' && value !== 'created') {
    throw badRequest('source must be upload, task or created')
  }
  return value
}

/** 检索的 `limit` 门禁：正整数且不超过硬上限（超上限按上限收，小于 1 一律 400）。 */
function requireSearchLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw badRequest('limit must be a positive integer')
  }
  return Math.min(value, LIBRARY_SEARCH_LIMIT)
}

/** 通用文本门禁：非字符串/空串/超长/含控制字符一律拒。 */
function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw badRequest(`${label} must be a non-empty string`)
  if (value.length > 256) throw badRequest(`${label} must be at most 256 characters`)
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) throw badRequest(`${label} must not contain control characters`)
  }
  return value
}

/**
 * **正文**门禁：只要是字符串就收（换行、制表、中文、空串都合法——正文不是标识符，不能套 `requireText`），
 * 唯一拒的是 NUL：写进去也读不回来（读侧 `decodeLibraryText` 有同一条判定），那是坏输入而不是内容。
 */
function requireContent(value: unknown, label: string): string {
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`)
  if (value.includes('\u0000')) throw new LibraryError('library/invalid-text', `${label} must not contain a NUL byte`)
  return value
}

/** 媒体类型门禁（`type/subtype` 形状即可，具体取值由资产 `kind` 决定默认值）。 */
function requireMediaType(value: string): string {
  if (!/^[a-z]+\/[A-Za-z0-9.+-]+$/.test(value)) throw badRequest('mediaType must look like type/subtype')
  return value
}

/** 原件字节门禁（只接受 `Uint8Array`）。 */
function requireBytes(value: unknown, label: string): Uint8Array {
  if (!(value instanceof Uint8Array)) throw badRequest(`${label} must be a Uint8Array`)
  return value
}

/** 扩展名门禁（与对象层同一条形状：小写字母数字、≤16）。 */
function requireExtension(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('extension must be a string')
  const normalized = value.toLowerCase()
  if (!/^[a-z0-9]{1,16}$/.test(normalized)) throw badRequest('extension must be lowercase alphanumeric')
  return normalized
}
