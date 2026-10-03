/**
 * [INPUT]: 依赖 zod（本地声明五张表的记录形状）与 `./keys.js` 的官方域名/表名规约
 * [OUTPUT]: 对外提供 `libraryDomainSpec`（`dshent_library` / version 1 / `layout:'per-record'` / 五张表 `nodes`·`assets`·`revisions`·`selections`·`drafts`）、五个记录 zod schema 与由它们推出的记录类型、写入前的 `parseLibraryRecord` 门禁、模块加载即跑的 `assertLibraryDomainSpec`（官方 `defineDomain` 那份 fail-loud 校验的本地等价物），以及**注入端口** `LibraryDomainPort`/`LibraryTablePort`（官方 `Domain`/`KvTable` 的结构镜像）
 * [POS]: bundle 资料库纵深的**域规格唯一真源**（方案 §2.1 落点），也是「不接宿主也能测」的关键：本文件不 import 任何 `@deepseek-ai/*`（官方 `dsh-storage-domain` 不在 bundle 的依赖里），只产出**纯规格对象 + 结构镜像类型**，由接线处把它交给 `ctx.storageDomain.open(spec)`；与 `contracts` 的合流留到那时（见文件末 TODO）
 * TODO（后续与 contracts 合流时上移）：本刀按任务口径把五张表的 zod 结构**本地声明在 bundle 内**（`contracts/` 仍不许碰）；下一刀上移成 `contracts/src/library-domain.ts`，bundle 改为 import，**类型名与方法签名逐字不变**（详见文件末的三条 TODO）
 * [PROTOCOL]: 变更时更新这份头部与域字段注释，然后检查 CLAUDE.md
 */

import { z } from 'zod'
import { LibraryError } from '../errors.js'
import { LIBRARY_UNIT_NAME_PATTERN } from './keys.js'

/**
 * 域身份。名字必须过官方 `UNIT_NAME_RE`（`^[a-z][a-z0-9_]*$`，`dsh-storage/lib/index.js:80`），
 * 域名同时**充当中介的 unit 名**（= 磁盘上是 `<backend root>/<domain name>/` 一层目录，probe 实测）。
 */
export const LIBRARY_DOMAIN_NAME = 'dshent_library'
/** 域格式版本：写进官方信封的 `version`（`{version, record}`），也写进每条记录的 `schemaVersion`。 */
export const LIBRARY_DOMAIN_VERSION = 1
/** 隐式根（"我的资料"）的展示标题（§4.4 A7 的 `space.title` 默认值）。根不落记录：`parentId === null` 即根。 */
export const LIBRARY_ROOT_TITLE = '我的资料'
/** 单会话选中节点数上限（A26:182，§4.4 C9）。 */
export const LIBRARY_MAX_SELECTION_NODES = 32

/**
 * ## 官方 per-record 的记录信封语义（照勘误 B2/C 与实测写清楚，实施时不许改口径）
 *
 * 每个记录文件是 **`{"version":<域版本>,"record":<值>}`**，2 空格缩进 + 尾换行，落在
 * `<backend root>/<域名>/<表名>/<key>.json`（probe 实测：`storages/dshent_library/nodes/node_root.json`，
 * 权限 `-rw-------`、目录 `drwx------`）。三条必须记住的后端行为：
 *
 * 1. **版本不被接受 ⇒ 静默丢弃、不迁移**。`layout:'per-record'` 的版本检查是**按记录**做的，
 *    版本戳不在接受集合里（或文件不是 JSON）的那条记录在 open 时**当作不存在**：open 成功、记录消失、
 *    不报错、**不做任何迁移**（官方 `dsh-storage-json/lib/index.js:146-158` 的 `parseRecord`；
 *    本仓 `./records.js` 的 `decodeRecordEnvelope` 是它逐条同形的表述）。
 * 2. **版本对但记录 schema 不符 ⇒ 整次 open 抛 `invalid-record`**（默认行为，我们不改）。
 *    资料库是权威数据，坏记录必须被看见（`invalidRecords:'backup-and-skip'` 是给可丢弃的派生数据用的，我们不声明）。
 * 3. **空域完全不落盘**：open 一个从未写过的域 = 零文件（目录都由第一次写触发），
 *    删除只删文件、**不删目录** ⇒ 任何断言都不许写"目录被清理了"。
 *
 * 另外两条与并发/容量有关的（勘误 B4、C）：
 * 4. **并发串行仅进程内**：同一服务实例的写链上 `put/delete/update` 串行、`update` 是写链原子 RMW；
 *    **跨进程没有文件锁**（last-write-wins）⇒ GUI 与 CLI 并存时以最后落盘者为准。
 * 5. **单记录不分片，但大正文不进 KV 记录**：一条记录 = 一个文件（2 MiB 的 value 也是一条记录，probe 实测），
 *    所以资料**正文只进对象层的 `content.md`**（草稿正文同理进**草稿对象层**，见 `drafts` 那一段），
 *    `revisions` 记录里只留相对路径 + sha256 + 字节数。
 */
/** 五张表在域里的名字（同时是磁盘上的五个目录名，都要过 `UNIT_NAME_RE`）。 */
export const LIBRARY_DOMAIN_TABLE_NAMES = ['nodes', 'assets', 'revisions', 'selections', 'drafts'] as const

/** 表名联合。 */
export type LibraryTableName = (typeof LIBRARY_DOMAIN_TABLE_NAMES)[number]

/** 通用 id：本仓各实体的 id 都是我们自己生成的短串（`nd_`/`as_`/`rv_`/`sessionId`），长度留足余量。 */
const libraryId = z.string().min(1).max(256)
/** ISO-8601 时间戳（workdsh A30 用的同一形状）。 */
const libraryIso = z.string().datetime()
/** 小写十六进制 sha256。 */
const librarySha256 = z.string().regex(/^[0-9a-f]{64}$/)

/**
 * 五张表共有的身份/版本四件套。
 *
 * · `schemaVersion`：记录形状版本（§4.4 A7 要求 `z.literal(1)`）——与信封里的**域级** `version` 各管一段：
 *   将来单张表演进（加字段）时改这里，而"整域换格式"才动信封版本；
 * · `scope` / `ownerId`：主体（方案 §7 R14 要求 P0 就在域里预留，避免 P2 做组织共享时重做主键）。
 *   `scope` 本刀只有 `'personal'`，P2 加 `'organization'` 时是**联合类型放宽**，键形状不变；
 * · `ownerId` 是**原始**值（不是归一化后的键片段）：键由 `libraryRecordKey` 现算，记录里留真源。
 */
const librarySubjectFields = {
  schemaVersion: z.literal(LIBRARY_DOMAIN_VERSION),
  scope: z.literal('personal'),
  ownerId: libraryId,
}

/**
 * `nodes` —— 目录树节点（文件夹与"文件节点"共用一棵树）。
 *
 * 与 workdsh A30 的 `node` 实体逐字段对照：`id`/`parentId`/`kind`/`assetId`/`createdAt`/`updatedAt` 同名同义；
 * `title` 合并了 workdsh 的 `node.name`（避免展示名两个真源），`depth` 提到顶层（workdsh 记在 `nested.depth` 里，
 * 那是"一主体一条大 JSON"时代的写法）。`parentId === null` 表示挂在隐式根 `LIBRARY_ROOT_TITLE` 下（depth = 0）。
 */
export const libraryNodeSchema = z.object({
  ...librarySubjectFields,
  id: libraryId,
  parentId: libraryId.nullable(),
  kind: z.enum(['folder', 'asset']),
  title: libraryId,
  depth: z.number().int().nonnegative(),
  assetId: libraryId.nullable(),
  createdAt: libraryIso,
  updatedAt: libraryIso,
})

/** 资产可承载的格式；与 workdsh A30 的 `asset.kind` 枚举逐字一致（P0 只做 markdown/text，枚举先摆满）。 */
export const LIBRARY_ASSET_KINDS = ['markdown', 'text', 'pdf', 'docx', 'pptx', 'html'] as const

/** 格式 → 默认媒体类型（写入 `assets.mediaType`；调用方不显式给媒体类型时用它）。 */
export const LIBRARY_DEFAULT_MEDIA_TYPES: Readonly<Record<(typeof LIBRARY_ASSET_KINDS)[number], string>> = {
  markdown: 'text/markdown',
  text: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  html: 'text/html',
}

/** 格式 → 原件在对象层的扩展名（落点是 `original.<ext>`，对象层用它拼文件名）。 */
export const LIBRARY_DEFAULT_EXTENSIONS: Readonly<Record<(typeof LIBRARY_ASSET_KINDS)[number], string>> = {
  markdown: 'md',
  text: 'txt',
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  html: 'html',
}

/**
 * `assets` —— 一份资料（树上的"文件"）的元数据。
 *
 * 与 A30 的 `asset` 对照：`id`/`nodeId`/`kind`/`mediaType`/`byteLength`/`status`/`source`/`createdAt`/`updatedAt` 同名同义；
 * `name` 按本刀口径保留（与节点 `title` 同步写入，节点是树位置、资产是内容身份）；
 * `currentRevisionId` 改成 `nullable`——**允许"已建资产、尚无修订"**（先占位再上传），
 * 空串会与"id 必须非空"的门禁冲突，`null` 才能表达"还没有修订"。
 */
export const libraryAssetSchema = z.object({
  ...librarySubjectFields,
  id: libraryId,
  nodeId: libraryId,
  name: libraryId,
  kind: z.enum(LIBRARY_ASSET_KINDS),
  mediaType: libraryId,
  byteLength: z.number().int().nonnegative(),
  currentRevisionId: libraryId.nullable(),
  status: z.enum(['active', 'disabled']).default('active'),
  source: z.enum(['upload', 'task', 'created']).default('upload'),
  createdAt: libraryIso,
  updatedAt: libraryIso,
})

/**
 * `revisions` —— 一条**不可变**修订的元数据。
 *
 * 与 A30 的 `revision` 对照：`number`/`originalSha256`/`originalByteLength`/`originalRelativePath`/
 * `contentSha256`/`conversionStatus`/`conversionWarnings`/`createdAt` 同名同义（`createdBy` 去掉：
 * 本刀主体就是 `ownerId`，不为同一个人造两个字段）。
 *
 * **与方案 §2.1 字面口径的差异（有意，按勘误 C）**：§2.1 写 `revisions: assetId/content`，但勘误 C 明确
 * 「大 value 一条记录一个文件 …… **禁止把大正文塞进 KV 记录**」⇒ 正文只进对象层
 * `<dshHome>/library/objects/<assetId>/<revisionId>/content.md`，记录里留
 * `contentRelativePath` + `contentSha256` + `contentByteLength` 三件套。好处：KV 记录永远是 O(1) 小 JSON，
 * 正文永远只有一份（不会出现"记录里一份、content.md 一份"的两个真源）。
 */
export const libraryRevisionSchema = z.object({
  ...librarySubjectFields,
  id: libraryId,
  assetId: libraryId,
  number: z.number().int().positive(),
  originalSha256: librarySha256,
  originalByteLength: z.number().int().nonnegative(),
  /** 相对对象层根（`<dshHome>/library/objects`）的路径：`<assetId>/<revisionId>/original.<ext>`。 */
  originalRelativePath: libraryId,
  contentSha256: librarySha256,
  contentByteLength: z.number().int().nonnegative(),
  /** 相对对象层根：`<assetId>/<revisionId>/content.md`。 */
  contentRelativePath: libraryId,
  /** 本刀：写了 `conversion.json` 就是 `ready`，没写就是 `pending`（`failed` 由转换器那一刀置位）。 */
  conversionStatus: z.enum(['ready', 'pending', 'failed']).default('pending'),
  conversionWarnings: z.array(z.string()).default([]),
  createdAt: libraryIso,
})

/**
 * `selections` —— "某个会话当前选了哪些资料"（A30 的 `reference` 数组按会话收敛成一条记录）。
 *
 * 主键按 A30/reference 的口径是 **sessionId**（记录 `id` 也存原始 sessionId），
 * `nodeIds` 上限 `LIBRARY_MAX_SELECTION_NODES`；顺序保留调用方给的顺序（界面 chips 的稳定序由调用方决定）。
 */
export const librarySelectionSchema = z.object({
  ...librarySubjectFields,
  id: libraryId,
  sessionId: libraryId,
  nodeIds: z.array(libraryId).max(LIBRARY_MAX_SELECTION_NODES),
  updatedAt: libraryIso,
})

/**
 * `drafts` —— 待审草稿（**可变**：员工/模型在发布前反复改它）。
 *
 * 与 A30 的 `draft` 实体对照：`id`/`assetId`/`baseRevisionId`/`revision`/`createdAt`/`updatedAt` 同名同义
 * （`createdBy` 去掉，理由同 `revisions`：本刀主体就是 `ownerId`）。
 *
 * **与 A30 字面口径的唯一差异（有意，按勘误 C）**：A30 的 draft 把正文放在 `content` 字段里
 * （`z.string().max(8 * 1024 * 1024)`），而本仓的存储纪律明写「**大正文不进 KV 记录**」
 * （见本文件头部第 5 条与 `objects.ts` 的 `LIBRARY_MAX_TEXT_BYTES`）⇒ 草稿正文落**草稿对象层**
 * `<dshHome>/library/drafts/<draftId>/<revision>.md`，记录里只留
 * `contentRelativePath` + `contentSha256` + `contentByteLength` 三件套（与 `revisions` 同一手法）。
 * 这样做同时买到两件事：KV 记录永远是 O(1) 小 JSON，且正文永远只有一份（不会出现"记录里一份、盘上一份"）。
 *
 * · `revision`：**乐观锁 token**（A30 的 `draft.revision`）——每次 `updateDraft` 换一枚新的；
 *   调用方必须把它原样带回来（工具的 `expected_revision`），不匹配一律拒，绝不"静默覆盖别人的改动"。
 * · `baseRevisionId`：草稿从哪一版正文分叉出来的。发布时若资产的当前修订已经不是它 ⇒ `library/base-revision-conflict`
 *   （别人在这中间发布了新版本，这份草稿的基准已经过期）。
 */
export const libraryDraftSchema = z.object({
  ...librarySubjectFields,
  id: libraryId,
  assetId: libraryId,
  baseRevisionId: libraryId,
  revision: libraryId,
  /** 相对**草稿对象层**根（`<dshHome>/library/drafts`）的路径：`<draftId>/<revision>.md`。 */
  contentRelativePath: libraryId,
  contentSha256: librarySha256,
  contentByteLength: z.number().int().nonnegative(),
  createdAt: libraryIso,
  updatedAt: libraryIso,
})

/** 表名 → schema（也是写入前门禁与假实现的校验入口）。 */
export const LIBRARY_TABLE_SCHEMAS = {
  nodes: libraryNodeSchema,
  assets: libraryAssetSchema,
  revisions: libraryRevisionSchema,
  selections: librarySelectionSchema,
  drafts: libraryDraftSchema,
} as const

/** 五张表的记录类型（全部由 zod 推出，schema 是唯一真源）。 */
export interface LibraryTableRecords {
  readonly nodes: z.infer<typeof libraryNodeSchema>
  readonly assets: z.infer<typeof libraryAssetSchema>
  readonly revisions: z.infer<typeof libraryRevisionSchema>
  readonly selections: z.infer<typeof librarySelectionSchema>
  readonly drafts: z.infer<typeof libraryDraftSchema>
}

export type LibraryNodeRecord = LibraryTableRecords['nodes']
export type LibraryAssetRecord = LibraryTableRecords['assets']
export type LibraryRevisionRecord = LibraryTableRecords['revisions']
export type LibrarySelectionRecord = LibraryTableRecords['selections']
export type LibraryDraftRecord = LibraryTableRecords['drafts']

/**
 * 一张表的声明（官方 `DomainTableSpec<V>` 的结构镜像：一个值 schema + 一个纯类型的 key 幽灵载体）。
 * 镜像而不是 import 的理由：`@deepseek-ai/dsh-storage-domain` 不在 bundle 的依赖里（本刀不接宿主）。
 */
export interface LibraryTableSpec<V> {
  /** 读取边界用于校验每条存量记录（官方字段名逐字一致）。 */
  readonly valueSchema: z.ZodType<V>
}

/** 域声明（官方 `DomainSpec` 的结构镜像，字段名逐字一致，只收窄 `layout` 到我们真的用的那档）。 */
export interface LibraryDomainSpec {
  readonly name: string
  readonly version: number
  readonly layout: 'per-record'
  readonly tables: { readonly [N in LibraryTableName]: LibraryTableSpec<LibraryTableRecords[N]> }
}

/**
 * 本仓资料库域规格（方案 §2.1 的 `defineDomain({name:'dshent_library', version:1, layout:'per-record', tables:{…}})`）。
 *
 * `defineDomain` 本身只是"fail-loud 校验 + 字面量收窄"（官方 `dsh-storage-domain/lib/index.js:52-75`）：
 * 校验域名/表名过 `UNIT_NAME_RE`、版本是非负整数、global 不接受 `null`，然后原样返回。本文件不 import 它，
 * 于是在模块加载时跑一份等价的 `assertLibraryDomainSpec`，语义不失真；接线那一刀把这个对象交给
 * `ctx.storageDomain.open(libraryDomainSpec)` 即可（官方 `open(spec)` 只读 `descriptorOf(spec)`）。
 */
export const libraryDomainSpec: LibraryDomainSpec = {
  name: LIBRARY_DOMAIN_NAME,
  version: LIBRARY_DOMAIN_VERSION,
  layout: 'per-record',
  tables: {
    nodes: { valueSchema: libraryNodeSchema },
    assets: { valueSchema: libraryAssetSchema },
    revisions: { valueSchema: libraryRevisionSchema },
    selections: { valueSchema: librarySelectionSchema },
    drafts: { valueSchema: libraryDraftSchema },
  },
}

/**
 * 域规格的 fail-loud 校验（等价官方 `defineDomain` 干的那几件事）：
 * 域名与每个表名必须过 `UNIT_NAME_RE`、版本必须是非负整数、必须至少有一张表、布局必须是 `per-record`。
 * 任何一条不满足 ⇒ 模块加载就抛（而不是等第一次落盘），这是官方`defineDomain`的纪律。
 */
export function assertLibraryDomainSpec(spec: LibraryDomainSpec): void {
  if (!LIBRARY_UNIT_NAME_PATTERN.test(spec.name)) {
    throw new Error(`library domain name '${spec.name}' must match ${LIBRARY_UNIT_NAME_PATTERN}`)
  }
  if (!Number.isInteger(spec.version) || spec.version < 0) {
    throw new Error(`library domain version must be a non-negative integer, got ${String(spec.version)}`)
  }
  if (spec.layout !== 'per-record') {
    throw new Error(`library domain must use layout 'per-record', got ${String(spec.layout)}`)
  }
  const names = Object.keys(spec.tables)
  if (names.length === 0) throw new Error('library domain must declare at least one table')
  for (const name of names) {
    if (!LIBRARY_UNIT_NAME_PATTERN.test(name)) {
      throw new Error(`library domain '${spec.name}' table name '${name}' must match ${LIBRARY_UNIT_NAME_PATTERN}`)
    }
  }
}

// 模块加载即校验：写错域名/表名的代价必须在 import 时就付，而不是等第一次写盘。
assertLibraryDomainSpec(libraryDomainSpec)

/**
 * 写入前的记录门禁：过一遍该表的 zod schema。
 *
 * 这一层是**我们自己的**（在 `put` 之前），因为官方 `KvTable.put` 明确不重新校验
 * （"validation happens at the durable read boundary"）——等到读取边界才失败，坏记录已经躺在盘上了。
 * `parse` 同时把 `.default()` 补齐（`status`/`source`/`conversionStatus`/`conversionWarnings`），
 * 所以服务层构造记录时可以省略这些字段，落库的一定是完整形状。
 *
 * @param table - 表名。
 * @param value - 待写入的记录（未知形状）。
 * @returns 过完门禁、补齐默认值后的记录。
 * @throws {LibraryError} `library/invalid-record`：形状不符。
 */
export function parseLibraryRecord<N extends LibraryTableName>(
  table: N,
  value: unknown,
): LibraryTableRecords[N] {
  const result = LIBRARY_TABLE_SCHEMAS[table].safeParse(value)
  if (!result.success) {
    throw new LibraryError('library/invalid-record', `library ${table} record does not match its schema`, {
      cause: result.error,
    })
  }
  return result.data as LibraryTableRecords[N]
}

/**
 * 官方 `KvTable<K,V>` 的结构镜像（`dsh-storage-domain/lib/types/domain.d.ts:36-78`）：读是**同步**的
 * （权威态在内存），写全部排队在域的写链上，`update` 是写链原子 RMW、键不存在时拒绝。
 *
 * 注入端口的意义：本刀的服务门面只依赖这七个方法，因此测试可以注入内存假实现跑，**不必接宿主**。
 */
export interface LibraryTablePort<V> {
  /** 同步读一条记录；不存在返回 `undefined`。 */
  get(key: string): V | undefined
  /** `[key, value]` 的**快照**迭代器（迭代期间落盘的写不改变本次迭代）。 */
  entries(): IterableIterator<[string, V]>
  /** 键的**快照**迭代器。顺序由后端决定（官方 json 后端是 `readdir` 序），**服务层不许依赖它**。 */
  keys(): IterableIterator<string>
  /** 当前记录数。 */
  readonly size: number
  /** 写入或覆盖一条记录（整条替换，不做局部合并）。 */
  put(key: string, value: V): Promise<void>
  /** 删除一条记录；返回它此前是否存在。 */
  delete(key: string): Promise<boolean>
  /** 写链上的原子读改写；键不存在时拒绝。 */
  update(key: string, fn: (current: V) => V): Promise<V>
}

/**
 * 官方 `Domain<S>` 的结构镜像（`dsh-storage-domain/lib/types/domain.d.ts:84-105`）：只用到 `name` 与 `table(name)`。
 * 接线时把 `ctx.storageDomain.open(libraryDomainSpec)` 的返回值直接传进来即可。
 */
export interface LibraryDomainPort {
  readonly name: string
  table<N extends LibraryTableName>(name: N): LibraryTablePort<LibraryTableRecords[N]>
}

// TODO(P0 后续刀 · 与 contracts 合流)：本刀按任务口径把五张表的 zod 结构**本地声明在 bundle 内**
// （`@dshent/contracts` 这一刀不许碰）。下一刀要把这里上移成 `contracts/src/library-domain.ts`（方案 §1.1 A30
// 的落点），由契约包同时导出 schema 与记录类型，bundle 只保留域规格装配与端口镜像；届时本文件改为
// `import { ... } from '@dshent/contracts'` 并把上面的 schema 段删掉——**类型名与方法签名逐字不变**。
// TODO(P0 后续刀 · 存储接线)：`bundle/src/index.ts` 的 `apply()` 里 `ctx.storageDomain.open(libraryDomainSpec)`
// 拿到 `Domain` 句柄后注入 `LibraryManager`（本刀刻意不接线，见 `./index.ts` 的说明）。
// TODO(P0 后续刀 · zod 落法)：本刀只把 zod 声明成 bundle 的 devDependency（本地 tsc/vitest 解析）。
// 接线那一刀必须决定运行时落法：① 升成 peerDependency 用宿主那份 zod（与官方 dsh-storage-domain 同一个实例），
// 或 ② 让 esbuild 内联。**不要留成 devDependency**——宿主运行期会解析不到。
