/**
 * [INPUT]: 依赖 node:fs/promises 与 node:os/node:path（临时 dshHome 落在 `~/.sshwork`，本机硬约束：`/tmp` 不可写），以及 src 的域规格（`LIBRARY_TABLE_SCHEMAS`/`LibraryDomainPort`）、主键字符集、per-record 信封编解码
 * [OUTPUT]: 对外提供 `createInMemoryLibraryDomain`（**纯内存假实现**：`KvTable` 七方法语义 + 可选 `persistRoot` 落盘）、`makeLibraryTempDir`（临时 dshHome/持久化根）、`createLibraryTestRig`（组装 domain + 对象层 + `LibraryManager` 的测试夹具）与写钩子类型
 * [POS]: tests 下的测试支撑（**不是产品代码**，`tsconfig.json` 的 `include` 只收 `src/**`，所以它只被 vitest 转译、不进 bundle 产物）。为什么用假实现而不是软链官方 `dsh-storage-domain`：① 本刀明确不接宿主，官方包不在 bundle 的依赖里（实测 `require.resolve('@deepseek-ai/dsh-storage-domain')` ⇒ `MODULE_NOT_FOUND`），软链会把"测试依赖宿主安装布局"带进门禁，宿主升级即红；② 官方后端的真实落盘形态已在 `~/.sshwork/libport-probe/`（probe.mjs / edge.mjs / disk-manifest.txt）用**真后端**实测归档，本刀不必重复；③ 本刀要证的恰恰是官方后端**不会**拒的东西（主键归一化、跨主体归属、串行顺序、补偿回滚），假实现才能确定性地造出来；④ 官方 `KvTable` 只有七个方法（`get`/`entries`/`keys`/`size`/`put`/`delete`/`update`），假实现**逐方法同构**，所以"注入端口"这一层不因换实现而失真
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { LibraryError } from '../src/library/errors.js'
import { LibraryManager, type LibraryLimits, type LibraryManagerOptions, type LibrarySubject } from '../src/library/manager.js'
import { LibraryObjectStore } from '../src/library/objects.js'
import {
  LIBRARY_DOMAIN_NAME,
  LIBRARY_TABLE_SCHEMAS,
  type LibraryDomainPort,
  type LibraryTableName,
  type LibraryTablePort,
  type LibraryTableRecords,
} from '../src/library/storage/domain.js'
import { LIBRARY_SAFE_KEY_PATTERN } from '../src/library/storage/keys.js'
import { decodeRecordEnvelope, encodeRecordEnvelope, LIBRARY_RECORD_ENVELOPE_VERSION } from '../src/library/storage/records.js'

/** 假实现里一次写操作的种类（与 `KvTable` 的三个写方法一一对应）。 */
export type InMemoryWriteKind = 'put' | 'delete' | 'update'

/** 假实现的构造选项（全部可选：默认 = 纯内存、无延迟、键按插入序）。 */
export interface InMemoryDomainOptions {
  /** 给了就落盘（镜像官方 json 后端的 per-record 形态），用于"跨重启持久化 / 空域不落盘 / 版本戳静默丢弃"三组断言。 */
  readonly persistRoot?: string | undefined
  /** 每次写前的延时（毫秒），用于把"多步写不交错"这类顺序断言做得更可观测。 */
  readonly writeDelayMs?: number | undefined
  /** `keys()`/`entries()` 返回**倒序**快照（官方是 `readdir` 序，故意造一个"非期望序"来证明服务层真的在排序）。 */
  readonly shuffleKeys?: boolean | undefined
  /** 写成功后的埋点（并发计数、写序记录用）。 */
  readonly onWrite?: ((table: LibraryTableName, kind: InMemoryWriteKind, key: string) => void) | undefined
  /** 写之前的钩子（可以让测试在队列里挂起，观察是否有别的写插进来）。 */
  readonly beforeWrite?: ((table: LibraryTableName, kind: InMemoryWriteKind, key: string) => void | Promise<void>) | undefined
  /** 注入一次写失败（补偿回滚断言用）；返回 `undefined` 表示这次不失败。 */
  readonly failWrite?: ((table: LibraryTableName, kind: InMemoryWriteKind, key: string) => Error | undefined) | undefined
}

/**
 * 内存假实现：一张表 = 一个 `Map`，读同步、写串在**域级写链**上（镜像官方"一个域一条写链"）。
 *
 * 与官方 `KvTable` 的逐方法对应见 `LibraryTablePort` 的注释；差异只有两条，都写在明处：
 * ① 官方 `put` 不重新校验 schema（"validation happens at the durable read boundary"），假实现**照抄**这一点：
 *    `put` 只管存，校验发生在 `persistRoot` 加载时与（更早的）服务层 `parseLibraryRecord`；
 * ② 假实现不做磁盘原子写（临时件 + rename 是官方后端与**对象层**的职责，本文件不重复模拟）。
 */
class InMemoryTable<V> implements LibraryTablePort<V> {
  private readonly records = new Map<string, V>()

  constructor(
    private readonly table: LibraryTableName,
    private readonly owner: InMemoryLibraryDomain,
  ) {}

  get(key: string): V | undefined {
    return this.records.get(key)
  }

  entries(): IterableIterator<[string, V]> {
    // 快照迭代（官方也是快照）：先取键快照，再映射成值，迭代期间的写不影响本次迭代。
    return this.snapshotKeys().map(key => [key, this.records.get(key)!] as [string, V]).values()
  }

  keys(): IterableIterator<string> {
    return this.snapshotKeys().values()
  }

  get size(): number {
    return this.records.size
  }

  async put(key: string, value: V): Promise<void> {
    return await this.owner.enqueueWrite(this.table, 'put', key, async () => {
      this.records.set(key, value)
      await this.owner.persistPut(this.table, key, value)
    })
  }

  async delete(key: string): Promise<boolean> {
    return await this.owner.enqueueWrite(this.table, 'delete', key, async () => {
      const existed = this.records.delete(key)
      if (existed) await this.owner.persistDelete(this.table, key)
      return existed
    })
  }

  async update(key: string, fn: (current: V) => V): Promise<V> {
    return await this.owner.enqueueWrite(this.table, 'update', key, async () => {
      const current = this.records.get(key)
      // 官方：键不存在时 `update` 拒绝（`missing-key`），假实现映射到同一族的 not-found。
      if (current === undefined) throw new LibraryError('library/not-found', 'in-memory table has no such key')
      const next = fn(current)
      this.records.set(key, next)
      await this.owner.persistPut(this.table, key, next)
      return next
    })
  }

  /** 内部：给加载器直接塞记录（不经过写链，模拟"open 时从盘上读回权威态"）。 */
  loadDirectly(key: string, value: V): void {
    this.records.set(key, value)
  }

  private snapshotKeys(): string[] {
    const keys = [...this.records.keys()]
    return this.owner.shufflesKeys ? keys.reverse() : keys
  }
}

/** 内存假域的对外形态（`LibraryDomainPort`）。 */
export class InMemoryLibraryDomain implements LibraryDomainPort {
  readonly name = LIBRARY_DOMAIN_NAME
  readonly shufflesKeys: boolean
  private readonly tables = new Map<LibraryTableName, InMemoryTable<unknown>>()
  private readonly options: InMemoryDomainOptions
  private chain: Promise<unknown> = Promise.resolve()

  private constructor(options: InMemoryDomainOptions) {
    this.options = options
    this.shufflesKeys = options.shuffleKeys === true
    for (const name of Object.keys(LIBRARY_TABLE_SCHEMAS) as LibraryTableName[]) {
      this.tables.set(name, new InMemoryTable<unknown>(name, this))
    }
  }

  /**
   * 建一个假域；给了 `persistRoot` 就先把盘上的记录读回来（**加载语义逐条镜像官方**）：
   * · 目录不存在 = 空域（不落盘、不建目录，官方"materialization defers to the first write"）；
   * · 文件名不是 `<key>.json` 或 key 不过 `SAFE_KEY_RE` 的**跳过**（官方 `lib/index.js:410-416`）；
   * · 信封版本不被接受或非 JSON ⇒ **静默当不存在**（官方 `parseRecord` / 勘误 C）；
   * · 版本对但 schema 不符 ⇒ **抛错**（官方默认策略就是整次 open 抛 `invalid-record`；我们不声明 backup-and-skip）。
   */
  static async create(options: InMemoryDomainOptions = {}): Promise<InMemoryLibraryDomain> {
    const domain = new InMemoryLibraryDomain(options)
    await domain.loadFromDisk()
    return domain
  }

  table<N extends LibraryTableName>(name: N): LibraryTablePort<LibraryTableRecords[N]> {
    const table = this.tables.get(name)
    if (table === undefined) throw new Error(`in-memory domain has no table '${name}'`)
    // 假实现内部按 `unknown` 存，出口按表名收窄 —— 测试替身里唯一一处断言。
    return table as unknown as LibraryTablePort<LibraryTableRecords[N]>
  }

  /** 写链：与官方一致，一个域一条链，写操作串行（读不进链）。 */
  async enqueueWrite<T>(table: LibraryTableName, kind: InMemoryWriteKind, key: string, task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      await this.options.beforeWrite?.(table, kind, key)
      const failure = this.options.failWrite?.(table, kind, key)
      if (failure !== undefined) throw failure
      if (this.options.writeDelayMs !== undefined) {
        await new Promise(resolve => setTimeout(resolve, this.options.writeDelayMs))
      }
      const result = await task()
      this.options.onWrite?.(table, kind, key)
      return result
    })
    this.chain = run.then(() => undefined, () => undefined)
    return await run
  }

  /** 落盘（`persistRoot` 给了才做）：`<root>/<域>/<表>/<key>.json`，0600/0700，信封与官方逐字同形。 */
  async persistPut(table: LibraryTableName, key: string, value: unknown): Promise<void> {
    if (this.options.persistRoot === undefined) return
    const directory = join(this.options.persistRoot, LIBRARY_DOMAIN_NAME, table)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(join(directory, `${key}.json`), encodeRecordEnvelope(LIBRARY_RECORD_ENVELOPE_VERSION, value), {
      encoding: 'utf8',
      mode: 0o600,
    })
  }

  async persistDelete(table: LibraryTableName, key: string): Promise<void> {
    if (this.options.persistRoot === undefined) return
    await rm(join(this.options.persistRoot, LIBRARY_DOMAIN_NAME, table, `${key}.json`), { force: true })
  }

  private async loadFromDisk(): Promise<void> {
    if (this.options.persistRoot === undefined) return
    for (const [name, table] of this.tables) {
      const directory = join(this.options.persistRoot, LIBRARY_DOMAIN_NAME, name)
      let files: string[]
      try {
        files = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      const schema = LIBRARY_TABLE_SCHEMAS[name]
      for (const file of files.sort()) {
        if (!file.endsWith('.json')) continue
        const key = file.slice(0, -'.json'.length)
        if (!LIBRARY_SAFE_KEY_PATTERN.test(key)) continue
        const record = decodeRecordEnvelope<unknown>(
          await readFile(join(directory, file), 'utf8'),
          [LIBRARY_RECORD_ENVELOPE_VERSION],
        )
        // 记录被判为 foreign（非 JSON / 版本不被接受）⇒ 静默丢弃、不迁移，与官方一致。
        if (record === undefined) continue
        const parsed = schema.safeParse(record)
        if (!parsed.success) {
          throw new LibraryError('library/invalid-record', `stored library ${name} record does not match its schema`, {
            cause: parsed.error,
          })
        }
        table.loadDirectly(key, parsed.data)
      }
    }
  }
}

/** 建一个内存假域（薄封装，保持测试可读）。 */
export async function createInMemoryLibraryDomain(options: InMemoryDomainOptions = {}): Promise<InMemoryLibraryDomain> {
  return await InMemoryLibraryDomain.create(options)
}

/**
 * 临时目录，落在 `~/.sshwork` 下（本仓硬约束：`/tmp` 不可写；既有 127 条测试用的是同一套办法）。
 * 生命周期由调用方负责（spec 里统一 `rm -rf`）。
 */
export async function makeLibraryTempDir(prefix: string): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  return await mkdtemp(join(root, prefix))
}

/** 测试夹具：临时 dshHome + 假域 + 真对象层 + 真服务门面（可选 `persistRoot` 做跨重启）。 */
export interface LibraryTestRig {
  readonly home: string
  readonly domain: InMemoryLibraryDomain
  readonly objects: LibraryObjectStore
  readonly manager: LibraryManager
}

/** 组装一套夹具；`manager` 的其余选项原样透传（`limits`/`newId`/`now`/`onError`…）。 */
export async function createLibraryTestRig(options: {
  readonly home: string
  readonly domain?: InMemoryLibraryDomain | undefined
  readonly manager?: Omit<LibraryManagerOptions, 'domain' | 'objects' | 'subject'> | undefined
  readonly subject?: LibrarySubject | undefined
}): Promise<LibraryTestRig> {
  const domain = options.domain ?? await createInMemoryLibraryDomain()
  const objects = new LibraryObjectStore({ dshHome: options.home })
  const manager = new LibraryManager({
    domain,
    objects,
    subject: options.subject ?? { scope: 'personal', ownerId: 'u1001' },
    ...(options.manager ?? {}),
  })
  return { home: options.home, domain, objects, manager }
}

/** 一套夹具的上限覆盖（测试里造小配额/小选择数）。 */
export type LibraryTestLimits = Partial<LibraryLimits>
