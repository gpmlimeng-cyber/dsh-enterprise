/**
 * [INPUT]: 依赖 node:fs/promises 的 open/rename/rm/lstat/realpath/mkdir/rmdir/readFile、node:crypto 的 randomUUID/createHash、node:path 的 join/dirname，以及本包 `./errors.js` 的稳定码与 `./storage/domain.js` 的格式枚举
 * [OUTPUT]: 对外提供 `LibraryObjectStore`（不可变原件的落盘所有者）与它的注入端口 `LibraryObjectStorePort`、`conversion.json` 的 schema/编解码 `libraryConversionSchema`/`encodeConversionRecord`/`decodeConversionRecord`、以及落点与上限常量（`LIBRARY_OBJECTS_DIR_SEGMENTS`/`LIBRARY_CONTENT_FILENAME`/`LIBRARY_CONVERSION_FILENAME`/`LIBRARY_MAX_ORIGINAL_BYTES`/`LIBRARY_MAX_TEXT_BYTES`/`LIBRARY_DEFAULT_EXTENSIONS`）
 * [POS]: bundle 资料库纵深的**二进制层**（方案 §2.1 的"自落盘"分支）：落点 `<dshHome>/library/objects/<assetId>/<revisionId>/{original.<ext>,content.md,conversion.json}`，与 workdsh 的存储结构逐字节一致；根是**构造参数注入**的（便于测试），不 import 任何宿主单例。落盘纪律两条：① 原子写 = 同目录 `.<uuid>.tmp` 写完 `sync` 再 `rename`，权限文件 `0o600`、目录 `0o700`，失败清理临时件；② 路径门禁 = `lstat`（不跟随符号链接）+ `realpath` 逐字等式**抄自**本包 `skill-install.ts`（见各方法注释里的行号），**抄判定逻辑而不是 import**（那里的函数名与语义都绑在"技能包内相对路径"上）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, rename, rm, rmdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { LibraryError, badRequest, libraryError } from './errors.js'
import { LIBRARY_ASSET_KINDS, LIBRARY_DEFAULT_EXTENSIONS } from './storage/domain.js'

/** 对象层在 `<dshHome>` 下的根（与 `skill-install.ts` 的 `<dshHome>/skills`、企业态的 `<dshHome>/enterprise` 互不嵌套）。 */
export const LIBRARY_OBJECTS_DIR_SEGMENTS = ['library', 'objects'] as const
/** 派生正文文件名（转换器那一刀写它，本刀只写与读）。 */
export const LIBRARY_CONTENT_FILENAME = 'content.md'
/** 转换元数据文件名（§4.4 A2 的形状：`{version,kind,originalSha256,warnings,locations}`）。 */
export const LIBRARY_CONVERSION_FILENAME = 'conversion.json'
/** 单份原件上限 50 MiB（A26:16 的"单文件 50 MiB"）。 */
export const LIBRARY_MAX_ORIGINAL_BYTES = 50 * 1024 * 1024
/** 单份转换正文上限 8 MiB（A26 / §4.4 C8 的"正文 >8 MiB ⇒ library/file-size"）。 */
export const LIBRARY_MAX_TEXT_BYTES = 8 * 1024 * 1024
/** `conversion.json` 上限 1 MiB（骨架级别的元数据，正常只有几 KB；给坏输入一个确定的上界）。 */
export const LIBRARY_MAX_CONVERSION_BYTES = 1024 * 1024

/**
 * 对象层 id 门禁：**客户端交来的永远是键形状，不是路径片段**（抄 `skill-install.ts:670-675` 的纪律，
 * 见 `:543-566` 的 `requireRelativeSkillPath`）。`..`、绝对路径、盘符、点、斜杠、空白、控制字符全部不命中。
 */
const LIBRARY_OBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const LIBRARY_OBJECT_ID_MAX_LENGTH = 512
/** 扩展名门禁：小写字母数字、≤16（写文件名前必须过它，别让 `../../x` 混进 `original.<ext>`）。 */
const LIBRARY_EXTENSION_PATTERN = /^[a-z0-9]{1,16}$/
/** sha256 十六进制（转换元数据里自带一份原件摘要，不是从别处抄来的）。 */
const LIBRARY_SHA256_PATTERN = /^[0-9a-f]{64}$/

/** `conversion.json` 的定位条目（转换器那一刀填，本刀只定义形状与读写）。 */
const libraryConversionLocationSchema = z.object({
  /** 定位种类：pdf=页、pptx=幻灯片、html=标题、docx/xlsx=表格块。 */
  kind: z.enum(['page', 'slide', 'heading', 'sheet']),
  /** 从 1 开始的序号（与 §4.4 B3/B4 的"段号/页号从 1 开始"一致）。 */
  ordinal: z.number().int().positive(),
  /** 该位置的标题/首行文本（截断由转换器负责）。 */
  text: z.string(),
})

/**
 * `conversion.json` 的记录形状（§4.4 A2 的键序即下面的声明序：`version`→`kind`→`originalSha256`→`warnings`→`locations`）。
 * zod 的输出对象按键声明序构造，因此序列化出来的键序是**确定的**（A2 要求逐字节可比）。
 */
export const libraryConversionSchema = z.object({
  version: z.literal(1),
  kind: z.enum(LIBRARY_ASSET_KINDS),
  originalSha256: z.string().regex(LIBRARY_SHA256_PATTERN),
  warnings: z.array(z.string()),
  locations: z.array(libraryConversionLocationSchema),
})

/** 一次转换的元数据（骨架：本刀只负责写入与读回）。 */
export type LibraryConversionRecord = z.infer<typeof libraryConversionSchema>

/** 写入一次修订所需的输入。 */
export interface LibraryRevisionWriteInput {
  readonly assetId: string
  readonly revisionId: string
  /** 原件扩展名（小写、不带点）；调用方通常由资产 `kind` 推出来。 */
  readonly extension: string
  /** 原件字节（不可变：**同一 revisionId 只允许写一次**）。 */
  readonly original: Uint8Array
  /** 派生正文（P0 的 md/txt 就是原件文本；转换器那一刀起由转换器产出）。空串是合法正文。 */
  readonly content: string
  /** 转换元数据；不传 = 本次不写 `conversion.json`（`conversionStatus` 记为 `pending`）。 */
  readonly conversion?: LibraryConversionRecord | undefined
}

/** 写入成功后回给服务层的事实（服务层把它写进 `revisions` 记录，正文本身不进 KV）。 */
export interface LibraryRevisionObjects {
  /** 对象层**真实**落点（`realpath` 之后的绝对路径）。 */
  readonly directory: string
  readonly originalFilename: string
  /** 相对对象层根（`<assetId>/<revisionId>/original.<ext>`），写进 `revisions.originalRelativePath`。 */
  readonly originalRelativePath: string
  readonly originalByteLength: number
  readonly originalSha256: string
  /** 相对对象层根（`<assetId>/<revisionId>/content.md`），写进 `revisions.contentRelativePath`。 */
  readonly contentRelativePath: string
  readonly contentByteLength: number
  readonly contentSha256: string
  readonly conversionWritten: boolean
}

/** 读回的一份正文。 */
export interface LibraryRevisionText {
  readonly text: string
  readonly byteLength: number
}

/** 读回的一份原件。 */
export interface LibraryRevisionOriginal {
  readonly bytes: Buffer
  readonly byteLength: number
  readonly sha256: string
}

/**
 * 服务门面真正依赖的对象层接口（注入用）。
 * 单独抽一个端口是为了让"多步写不交错"这类顺序断言可以注入一个带延迟与埋点的实现（见 tests）。
 */
export interface LibraryObjectStorePort {
  writeRevision(input: LibraryRevisionWriteInput): Promise<LibraryRevisionObjects>
  readRevisionText(assetId: string, revisionId: string): Promise<LibraryRevisionText>
  readRevisionOriginal(assetId: string, revisionId: string, extension: string): Promise<LibraryRevisionOriginal>
  readRevisionConversion(assetId: string, revisionId: string): Promise<LibraryConversionRecord | undefined>
  revisionExists(assetId: string, revisionId: string): Promise<boolean>
  removeRevisionObjects(assetId: string, revisionId: string): Promise<boolean>
}

/** 构造参数：根必须显式给（`dshHome` 由 Host 侧解析，本层不猜 `$DSH_HOME`）。 */
export interface LibraryObjectStoreOptions {
  readonly dshHome: string
}

/**
 * 资料库对象层：`<dshHome>/library/objects/<assetId>/<revisionId>/` 的唯读写者。
 *
 * 读语义（逐条明确，避免"缺文件算什么"这种含糊）：
 * | 情况 | 结果 |
 * |---|---|
 * | 对象根不存在 | `library/not-found`（还没有任何资料） |
 * | 修订目录不存在 | `library/object-missing`（记录在、原件没了） |
 * | 落点是目录冒充文件 / 符号链接 | `library/object-invalid` |
 * | `realpath` 不等于期望落点 | `library/path-escape`（逃出对象根，fail-closed） |
 * | `content.md` 是 0 字节 | **合法**：`text: ''`、`byteLength: 0`（空正文是合法修订） |
 * | `content.md` > 8 MiB | `library/file-too-large`（先看 `lstat.size`，不把超大文件读进内存） |
 * | `content.md` 非法 UTF-8 或夹 NUL | `library/invalid-text`（二进制冒充文本） |
 * | `original.<ext>` 是 0 字节 | **合法**：0 字节原件，sha256 为空内容的摘要 |
 * | `original.<ext>` > 50 MiB | `library/file-too-large` |
 * | `conversion.json` 不存在 | 返回 `undefined`（**尚未转换是合法态**，不是错误） |
 * | `conversion.json` 空 / 非 JSON / 形状不符 | `library/conversion-invalid` |
 */
export class LibraryObjectStore implements LibraryObjectStorePort {
  private readonly dshHome: string

  constructor(options: LibraryObjectStoreOptions) {
    if (typeof options?.dshHome !== 'string' || options.dshHome.length === 0) {
      throw badRequest('library object store needs a dshHome root')
    }
    this.dshHome = options.dshHome
  }

  /** 对象层根（未规范化）：`<dshHome>/library/objects`。 */
  get root(): string {
    return join(this.dshHome, ...LIBRARY_OBJECTS_DIR_SEGMENTS)
  }

  /**
   * 纯路径组合（**做过 id 门禁**，但**不碰盘**）：`<root>/<assetId>/<revisionId>`。
   * 给调用方拼日志/相对路径用；任何要落盘或读盘的路径都必须再走下面的 `resolve*` 系列。
   */
  expectedRevisionDirectory(assetId: string, revisionId: string): string {
    return join(this.root, requireObjectId(assetId, 'assetId'), requireObjectId(revisionId, 'revisionId'))
  }

  /** 修订落点是否已在盘上（任何类型的存在都算：目录/文件/符号链接）。 */
  async revisionExists(assetId: string, revisionId: string): Promise<boolean> {
    const directory = this.expectedRevisionDirectory(assetId, revisionId)
    return (await lstatOrUndefined(directory)) !== undefined
  }

  /**
   * 写入一条**不可变**修订的三件落盘物。
   *
   * **不可变语义：同一 revisionId 二次写入一律拒绝（`library/revision-immutable`），不做字节比对也不幂等覆盖。**
   * 理由：`(assetId, revisionId)` 是内容的身份，"这个 id 下面的字节是什么"必须是常量；一旦允许"相同则通过"，
   * 重试路径就会依赖"读出旧字节再比一遍"这种带 TOCTOU 的实现，而它一旦写错就是**静默换内容**。
   * 重试的幂等由上层承担（§4.4 C1/F9 的 `operationId` 幂等回执），对象层只做最后一道闸，fail-closed。
   * 需要"先探后写"的调用方用 `revisionExists`。
   *
   * 落盘顺序：先 `mkdir` 目录（`0o700`）→ 逐件原子写（同目录 `.<uuid>.tmp` + `sync` + `rename`，`0o600`）
   * → 三件写完再逐件验一遍身份（`lstat` + `realpath` 逐字等式）。任何一步失败：删临时件、把**本次新建**的
   * 修订目录整目录删掉（绝不留半成品），再抛稳定码。
   *
   * @param input - 落点与字节（见 `LibraryRevisionWriteInput`）。
   * @returns 真实落点、相对路径、字节数与 sha256（服务层据此写 `revisions` 记录）。
   * @throws {LibraryError} `library/invalid-request`（id/扩展名/字节形状非法）、`library/file-too-large`、
   *   `library/revision-immutable`（已存在）、`library/internal`（I/O 失败）。
   */
  async writeRevision(input: LibraryRevisionWriteInput): Promise<LibraryRevisionObjects> {
    const assetId = requireObjectId(input.assetId, 'assetId')
    const revisionId = requireObjectId(input.revisionId, 'revisionId')
    const extension = requireExtension(input.extension)
    const original = requireBytes(input.original, 'original')
    const content = requireText(input.content, 'content')
    if (original.byteLength > LIBRARY_MAX_ORIGINAL_BYTES) {
      throw new LibraryError('library/file-too-large', `library original exceeds ${LIBRARY_MAX_ORIGINAL_BYTES} bytes`)
    }
    const contentBytes = Buffer.from(content, 'utf8')
    if (contentBytes.byteLength > LIBRARY_MAX_TEXT_BYTES) {
      throw new LibraryError('library/file-too-large', `library content exceeds ${LIBRARY_MAX_TEXT_BYTES} bytes`)
    }
    const conversion = input.conversion === undefined ? undefined : encodeConversionRecord(input.conversion)
    if (conversion !== undefined && Buffer.byteLength(conversion, 'utf8') > LIBRARY_MAX_CONVERSION_BYTES) {
      throw new LibraryError('library/file-too-large', `library conversion metadata exceeds ${LIBRARY_MAX_CONVERSION_BYTES} bytes`)
    }

    const { resolvedRoot } = await this.ensureRoot()
    const directory = join(resolvedRoot, assetId, revisionId)
    const originalFilename = `original.${extension}`
    const filenames = [originalFilename, LIBRARY_CONTENT_FILENAME, ...(conversion === undefined ? [] : [LIBRARY_CONVERSION_FILENAME])]

    // 不可变闸：落点已存在（文件/目录/符号链接一律算存在）⇒ 拒。这里用 lstat 而不是 exists：
    // 悬空符号链接在 exists/stat 眼里"不存在"，但 lstat 看得见它——那正是最该被拒的一种存在。
    if ((await lstatOrUndefined(directory)) !== undefined) {
      throw new LibraryError('library/revision-immutable', 'library revision objects already exist')
    }

    try {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      // 抄 skill-install.ts:633-651：目录必须 lstat 是普通目录，且 realpath 逐字等于期望落点。
      await assertDirectoryIdentity(directory)
      await writeAtomicFile(join(directory, originalFilename), original)
      await writeAtomicFile(join(directory, LIBRARY_CONTENT_FILENAME), content)
      if (conversion !== undefined) await writeAtomicFile(join(directory, LIBRARY_CONVERSION_FILENAME), conversion)
      // 三件写完后再逐件验一遍（抄 skill-install.ts:702-721 的文件等式）：父目录被换成符号链接的 TOCTOU 也在这里兜住。
      for (const filename of filenames) await assertFileIdentity(join(directory, filename))
    } catch (error) {
      // 失败清理：本方法只可能在"目录是本次新建"的前提下走到这里（存在已在上面拒掉），
      // 所以整目录删掉是安全的；顺便删掉可能刚刚建出来的空资产目录（只删空目录，绝不递归删别人的东西）。
      await rm(directory, { force: true, recursive: true }).catch(() => undefined)
      await rmdir(join(resolvedRoot, assetId)).catch(() => undefined)
      throw libraryError(error, 'library/internal', 'library revision objects could not be written')
    }

    const originalSha256 = sha256Of(original)
    return {
      directory,
      originalFilename,
      originalRelativePath: [assetId, revisionId, originalFilename].join('/'),
      originalByteLength: original.byteLength,
      originalSha256,
      contentRelativePath: [assetId, revisionId, LIBRARY_CONTENT_FILENAME].join('/'),
      contentByteLength: contentBytes.byteLength,
      contentSha256: sha256Of(contentBytes),
      conversionWritten: conversion !== undefined,
    }
  }

  /**
   * 读一条修订的正文（`content.md`）。
   *
   * 空文件是合法的空正文；先按 `lstat.size` 判上限再读；用 `TextDecoder(fatal)` 严格解码，
   * 非法 UTF-8 或夹 NUL 一律按二进制拒（抄 `skill-install.ts:733-800` 那段文本读取的同一套判定）。
   */
  async readRevisionText(assetId: string, revisionId: string): Promise<LibraryRevisionText> {
    const { size, path } = await this.resolveRevisionFile(assetId, revisionId, LIBRARY_CONTENT_FILENAME, LIBRARY_MAX_TEXT_BYTES)
    const bytes = size === 0 ? Buffer.alloc(0) : await readFile(path)
    return { text: decodeLibraryText(bytes), byteLength: bytes.byteLength }
  }

  /** 读一条修订的原件字节（空文件合法；上限 50 MiB，同样先按 size 判再读）。 */
  async readRevisionOriginal(assetId: string, revisionId: string, extension: string): Promise<LibraryRevisionOriginal> {
    const filename = `original.${requireExtension(extension)}`
    const { size, path } = await this.resolveRevisionFile(assetId, revisionId, filename, LIBRARY_MAX_ORIGINAL_BYTES)
    const bytes = size === 0 ? Buffer.alloc(0) : await readFile(path)
    return { bytes, byteLength: bytes.byteLength, sha256: sha256Of(bytes) }
  }

  /**
   * 读 `conversion.json`。**文件不存在 ⇒ `undefined`**（尚未转换是合法态）；
   * 空文件/非 JSON/形状不符 ⇒ `library/conversion-invalid`（空文件不走"缺文件"那条分支，必须报出来）。
   */
  async readRevisionConversion(assetId: string, revisionId: string): Promise<LibraryConversionRecord | undefined> {
    const directory = await this.resolveExistingRevisionDirectory(assetId, revisionId)
    const path = join(directory, LIBRARY_CONVERSION_FILENAME)
    const stats = await lstatOrUndefined(path)
    if (stats === undefined) return undefined
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new LibraryError('library/object-invalid', 'library conversion metadata is not a regular file')
    }
    if (stats.size > LIBRARY_MAX_CONVERSION_BYTES) {
      throw new LibraryError('library/file-too-large', `library conversion metadata exceeds ${LIBRARY_MAX_CONVERSION_BYTES} bytes`)
    }
    await assertFileIdentity(path)
    return decodeConversionRecord(await readFile(path, 'utf8'))
  }

  /**
   * 删除一条修订的整个对象目录（`removeAsset` / `removeNode` 的级联用）。
   *
   * **删之前必须过路径门禁**：目录存在 ⇒ `lstat` 是普通目录 + `realpath` 逐字等于期望落点；
   * 门禁不过一律拒（宁可留下垃圾，绝不让 `rm -rf` 跑到对象根外面）。删完顺手 `rmdir` 掉空掉的资产目录
   * （`rmdir` 对非空目录会失败，正好只删空目录）。
   *
   * @returns 是否真的删掉了东西。
   */
  async removeRevisionObjects(assetId: string, revisionId: string): Promise<boolean> {
    const safeAssetId = requireObjectId(assetId, 'assetId')
    const safeRevisionId = requireObjectId(revisionId, 'revisionId')
    const { resolvedRoot } = await this.resolveObjectRoot()
    const directory = join(resolvedRoot, safeAssetId, safeRevisionId)
    const stats = await lstatOrUndefined(directory)
    if (stats === undefined) return false
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new LibraryError('library/object-invalid', 'library revision path is not a regular directory')
    }
    await assertDirectoryIdentity(directory)
    await rm(directory, { force: true, recursive: true })
    await rmdir(join(resolvedRoot, safeAssetId)).catch(() => undefined)
    return true
  }

  /** 对象根必须存在（读路径）：不存在 ⇒ `library/not-found`；跟着符号链接解析出真实根。 */
  private async resolveObjectRoot(): Promise<{ root: string; resolvedRoot: string }> {
    const root = this.root
    const resolvedRoot = await realpathOrUndefined(root)
    if (resolvedRoot === undefined) {
      throw new LibraryError('library/not-found', 'library object root is missing')
    }
    return { root, resolvedRoot }
  }

  /** 对象根必须存在（写路径）：不存在就建（`0o700`），返回真实根（抄 `skill-install.ts:602-606` 的根解析）。 */
  private async ensureRoot(): Promise<{ root: string; resolvedRoot: string }> {
    const root = this.root
    try {
      await mkdir(root, { recursive: true, mode: 0o700 })
    } catch (error) {
      throw libraryError(error, 'library/internal', 'library object root could not be created')
    }
    const resolvedRoot = await realpath(root).catch((error: unknown) => {
      throw libraryError(error, 'library/internal', 'library object root could not be resolved')
    })
    return { root, resolvedRoot }
  }

  /** 解析一条**已存在**的修订目录：`<真实根>/<assetId>/<revisionId>`，逐条门禁后返回真实路径。 */
  private async resolveExistingRevisionDirectory(assetId: string, revisionId: string): Promise<string> {
    const safeAssetId = requireObjectId(assetId, 'assetId')
    const safeRevisionId = requireObjectId(revisionId, 'revisionId')
    const { resolvedRoot } = await this.resolveObjectRoot()
    const directory = join(resolvedRoot, safeAssetId, safeRevisionId)
    const stats = await lstatOrUndefined(directory)
    if (stats === undefined) {
      throw new LibraryError('library/object-missing', 'library revision directory is missing')
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new LibraryError('library/object-invalid', 'library revision path is not a regular directory')
    }
    await assertDirectoryIdentity(directory)
    return directory
  }

  /** 解析一条已存在的普通文件（先目录门禁、再文件门禁、最后判大小上限），返回落点与大小。 */
  private async resolveRevisionFile(
    assetId: string,
    revisionId: string,
    filename: string,
    maxBytes: number,
  ): Promise<{ path: string; size: number }> {
    const directory = await this.resolveExistingRevisionDirectory(assetId, revisionId)
    const path = join(directory, filename)
    const stats = await lstatOrUndefined(path)
    if (stats === undefined) {
      throw new LibraryError('library/object-missing', 'library revision file is missing')
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new LibraryError('library/object-invalid', 'library revision file is not a regular file')
    }
    if (stats.size > maxBytes) {
      throw new LibraryError('library/file-too-large', `library revision file exceeds ${maxBytes} bytes`)
    }
    await assertFileIdentity(path)
    return { path, size: stats.size }
  }
}

/** 对象层 id 门禁（`..`/绝对路径/点/斜杠/空白/控制字符一律不命中）。 */
function requireObjectId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIBRARY_OBJECT_ID_MAX_LENGTH) {
    throw badRequest(`${label} must be a non-empty string of at most ${LIBRARY_OBJECT_ID_MAX_LENGTH} characters`)
  }
  if (!LIBRARY_OBJECT_ID_PATTERN.test(value)) throw badRequest(`${label} must be a safe path segment, not a path`)
  return value
}

/** 扩展名门禁：小写字母数字、≤16，拼进 `original.<ext>` 之前必须过。 */
function requireExtension(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('extension must be a string')
  const normalized = value.toLowerCase()
  if (!LIBRARY_EXTENSION_PATTERN.test(normalized)) throw badRequest('extension must be lowercase alphanumeric')
  return normalized
}

/** 原件字节门禁：只接受 `Uint8Array`（`Buffer` 是它的子类，天然通过）。 */
function requireBytes(value: unknown, label: string): Uint8Array {
  if (!(value instanceof Uint8Array)) throw badRequest(`${label} must be a Uint8Array`)
  return value
}

/** 正文门禁：只接受字符串（空串合法；类型不对是编程错误，不当成空内容处理）。 */
function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`)
  return value
}

/** sha256 小写十六进制。 */
function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** `ENOENT` 是"不在那儿"而不是故障：路径门禁靠它区分"缺"与"读不了"（抄 `skill-install.ts:517-524`）。 */
async function realpathOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw libraryError(error, 'library/internal', 'library object path could not be resolved')
  }
}

/** `lstat` 版本的同名助手：**不跟随符号链接**，所以我们能看到"悬空符号链接"这种最该拒的存在。 */
async function lstatOrUndefined(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw libraryError(error, 'library/internal', 'library object path could not be inspected')
  }
}

/**
 * 目录身份等式（**抄 `skill-install.ts:633-651`**：`lstat` 不跟随符号链接 ⇒ 是符号链接即拒；
 * 不是目录即拒；`realpath` 必须**逐字等于期望落点** ⇒ 任何一层符号链接逃逸都会让等式不成立）。
 *
 * 期望落点就是传入的 `directory`：调用方拼的正是 `<真实根>/<assetId>/<revisionId>`
 * （根已 `realpath`、两个 id 已过键形状门禁），所以"逐字等式"落在同一个字符串上。
 * `skill-install.ts` 那里要分两个变量（未规范化根拼落点、`realpath` 根比等式），
 * 纯粹因为它的根来自配置且可能带符号链接；本层把根先规范化再拼，等式因此合一。
 */
async function assertDirectoryIdentity(directory: string): Promise<void> {
  const stats = await lstatOrUndefined(directory)
  if (stats === undefined) {
    throw new LibraryError('library/object-missing', 'library object directory disappeared during the operation')
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new LibraryError('library/object-invalid', 'library object path is not a regular directory')
  }
  const resolved = await realpathOrUndefined(directory)
  if (resolved !== directory) {
    throw new LibraryError('library/path-escape', 'library object directory escapes the objects root')
  }
}

/**
 * 文件身份等式（**抄 `skill-install.ts:702-721`**：`lstat` 不跟随符号链接 ⇒ 文件本身是符号链接即拒；
 * 非普通文件即拒；`realpath` 必须逐字等于期望落点 ⇒ 父目录被换成符号链接也逃不过）。
 */
async function assertFileIdentity(path: string): Promise<void> {
  const stats = await lstatOrUndefined(path)
  if (stats === undefined) {
    throw new LibraryError('library/object-missing', 'library object file disappeared during the operation')
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new LibraryError('library/object-invalid', 'library object file is not a regular file')
  }
  const resolved = await realpathOrUndefined(path)
  if (resolved !== path) {
    throw new LibraryError('library/path-escape', 'library object file escapes its revision directory')
  }
}

/**
 * 原子写一个文件（**抄 `skill-install.ts:245-256` 的"同目录临时件 + rename"与官方 `dsh-storage-json`
 * `lib/index.js:25-41` `writeAtomic` 的细节**）：
 * 同目录 `.<uuid>.tmp` → `open('wx', 0o600)`（`'wx'` 保证绝不覆盖任何已存在的临时件；
 * `0o600` 与官方 `writeAtomic` 的 `384` 一致）→ `writeFile` → `handle.sync()`（**先落盘再改名**：
 * `rename` 之后任何时刻断电，看到的都只会是完整文件）→ `close` → `rename` → 目录 `sync`（尽力而为）→
 * 任何一步失败都 `rm` 掉临时件并抛稳定码。
 */
async function writeAtomicFile(target: string, data: Uint8Array | string): Promise<void> {
  const temporary = join(dirname(target), `.${randomUUID()}.tmp`)
  try {
    const handle = await open(temporary, 'wx', 0o600)
    try {
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, target)
    await syncDirectory(dirname(target))
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw libraryError(error, 'library/internal', 'library object file could not be written')
  }
}

/**
 * 目录 `fsync`（让"改名"这个元数据操作也落盘）：**尽力而为**。
 * Android 的 sdcardfs/FUSE 挂载对目录 `fsync` 会返回 `EINVAL`/`ENOTSUP`，那里不该因此让一次完整的写入失败——
 * 数据本身已由文件 `handle.sync()` + `rename` 保证，目录项多一次 fsync 只是更强的持久性，不是正确性前提。
 */
async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await open(directory, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // 见上方注释：目录 fsync 是增强项，失败不改变"文件已原子落盘"的事实。
  }
}

/**
 * 严格 UTF-8 解码（抄 `skill-install.ts:733-800` 的判定）：`fatal` 解码失败或夹 NUL 都按二进制拒，
 * 不让"半个字符"或 NUL 混进模型上下文。
 *
 * @throws {LibraryError} `library/invalid-text`。
 */
function decodeLibraryText(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw new LibraryError('library/invalid-text', 'library content is not valid UTF-8', { cause: error })
  }
  if (text.includes('\u0000')) {
    throw new LibraryError('library/invalid-text', 'library content contains a NUL byte')
  }
  return text
}

/**
 * 序列化 `conversion.json`：`JSON.stringify(parse(record), null, 2)` + 尾换行。
 * 先 `parse` 再序列化，一举两得：① 形状门禁在写入前生效；② zod 输出对象按键**声明序**构造，
 * 所以磁盘上的键序恒为 `version,kind,originalSha256,warnings,locations`（§4.4 A2 要求逐字节可比）。
 */
export function encodeConversionRecord(record: LibraryConversionRecord): string {
  const parsed = libraryConversionSchema.safeParse(record)
  if (!parsed.success) {
    throw new LibraryError('library/conversion-invalid', 'library conversion metadata does not match its schema', {
      cause: parsed.error,
    })
  }
  return `${JSON.stringify(parsed.data, null, 2)}\n`
}

/**
 * 反序列化 `conversion.json`：空文件 / 非 JSON / 形状不符 ⇒ `library/conversion-invalid`
 * （与"文件不存在 ⇒ `undefined`"是两条不同的语义，缺文件是合法的未转换态，空文件是坏文件）。
 */
export function decodeConversionRecord(text: string): LibraryConversionRecord {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch (error) {
    throw new LibraryError('library/conversion-invalid', 'library conversion metadata is not valid JSON', { cause: error })
  }
  const parsed = libraryConversionSchema.safeParse(document)
  if (!parsed.success) {
    throw new LibraryError('library/conversion-invalid', 'library conversion metadata does not match its schema', {
      cause: parsed.error,
    })
  }
  return parsed.data
}

/** 默认扩展名（服务层按资产 `kind` 推原件文件名时用）。 */
export function defaultLibraryExtension(kind: (typeof LIBRARY_ASSET_KINDS)[number]): string {
  return LIBRARY_DEFAULT_EXTENSIONS[kind]
}
