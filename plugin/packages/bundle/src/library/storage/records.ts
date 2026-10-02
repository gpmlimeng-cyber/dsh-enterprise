/**
 * [INPUT]: 只依赖官方 `dsh-storage-json` 的 per-record 落盘事实（信封形状、版本戳语义、临时件命名）
 * [OUTPUT]: 对外提供 per-record 记录信封的编解码纯函数 `encodeRecordEnvelope`/`decodeRecordEnvelope` 与常量 `LIBRARY_RECORD_ENVELOPE_VERSION`
 * [POS]: bundle 资料库纵深对**官方 per-record 信封语义**的可执行表述——官方后端自己会写这个信封，本刀不接管落盘（存储句柄是注入的），所以本文件有两个用途：① 把「版本不被接受 ⇒ 静默丢弃、不迁移」这条语义写成代码而不是注释；② 给测试的内存假实现复用，保证假实现不会与官方后端悄悄漂移（假实现里还有一条「版本对但 schema 不符 ⇒ 加载失败」的镜像）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 域格式版本。官方信封里 `version` 是**域级**版本（`defineDomain({version})`），不是记录形状版本；
 * 每条记录里另有一个 `schemaVersion` 字段（§4.4 A7），两者本刀都 = 1。
 */
export const LIBRARY_RECORD_ENVELOPE_VERSION = 1

/** 官方 per-record 文档的形状（`{"version":<域版本>,"record":<值>}`）。 */
export interface LibraryRecordEnvelope<T> {
  readonly version: number
  readonly record: T
}

/**
 * 编码一条记录文档。
 *
 * 逐字对齐官方 `dsh-storage-json/lib/index.js:127-133` 的 `serializeRecord`：
 * `JSON.stringify({version, record}, null, 2)` **再加一个尾换行**（2 空格缩进 + 尾 `\n`，勘误 B2 已实测确认）。
 */
export function encodeRecordEnvelope<T>(version: number, record: T): string {
  return `${JSON.stringify({ version, record }, null, 2)}\n`
}

/**
 * 解码一条记录文档，**语义逐条对齐官方 `parseRecord`（`dsh-storage-json/lib/index.js:146-158`）与勘误 C**：
 *
 * | 盘上内容 | 结果 |
 * |---|---|
 * | 非 JSON（含空文件、截断的 JSON） | `undefined` —— **静默当不存在**，open 成功、记录消失、不报错 |
 * | 不是对象 / 是 `null` | `undefined` —— 同上 |
 * | `version` 不是数字，或不在接受集合里 | `undefined` —— **静默丢弃、不迁移**（per-record 的版本检查是按记录做的） |
 * | `version` 被接受 | 返回 `record`（**形状是否合法不在这里判**：官方在读取边界用 zod 校验，默认整次 open 抛 `invalid-record`，声明 `invalidRecords:'backup-and-skip'` 才改名挪走） |
 *
 * 我们**不声明** `invalidRecords: 'backup-and-skip'`：资料库是权威数据，坏记录必须让 open 失败并被人看见，
 * 而不是被悄悄改名跳过（errata C 的两条读语义里，那条是给"可丢弃的派生数据"用的）。
 *
 * @param text - 盘上一条记录文件的完整文本。
 * @param acceptedVersions - 被接受的域版本集合（本刀只有 `[LIBRARY_RECORD_ENVELOPE_VERSION]`）。
 * @returns 记录值；判为 foreign 时返回 `undefined`。
 */
export function decodeRecordEnvelope<T>(text: string, acceptedVersions: readonly number[]): T | undefined {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    // 非 JSON：官方把 unreadable 与 stale 一视同仁地当作"这条记录不在"，本函数照抄这个语义。
    return undefined
  }
  if (typeof document !== 'object' || document === null) return undefined
  const { version, record } = document as { version?: unknown; record?: unknown }
  if (typeof version !== 'number' || !acceptedVersions.includes(version)) return undefined
  return record as T
}
