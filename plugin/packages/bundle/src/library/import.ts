/**
 * [INPUT]: 依赖 node:crypto（sha256）、本包 `./errors.js`（稳定码）、`./manager.js`（服务门面：`createAsset`/`writeRevision`/`removeAsset`）、`./objects.js`（`LIBRARY_MAX_ORIGINAL_BYTES` 与 `LIBRARY_MAX_TEXT_BYTES` 两条上限）
 * [OUTPUT]: 对外提供 `libraryTextKindOf`（按扩展名判 markdown/text，不认别的格式）、`normalizeLibraryText`（方案 §4.1 F3 的 md/txt 口径：只做 `\r\n?`→`\n`）、`importLibraryText`（一次导入 = 建资产 → 写修订 + `conversion.json`，失败补偿掉那份空资产）与输入/结果类型
 * [POS]: 资料库的**文本导入**唯一实现（P0 只做 md/txt）：路由的 `import` 分支与工具 `library_save_markdown` 共用这一份，绝不各写一遍"建资产 + 估字节 + 拼转换元数据"。原件字节 = 浏览器读到的原始文本字节（保留 `\r\n`，它是"原件"），派生正文 = 归一化后的文本（`content.md`，它是"转换结果"）——两者不混为一谈
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { badRequest } from './errors.js'
import type { LibraryAssetKind, LibraryAssetSource, LibraryManager } from './manager.js'
import type { LibraryAssetRecord, LibraryRevisionRecord } from './storage/domain.js'

/** 认识的扩展名 → 资产格式（P0 只有这两档；pdf/docx/pptx/html 留给转换器那一刀）。 */
const LIBRARY_TEXT_EXTENSIONS: Readonly<Record<string, LibraryAssetKind>> = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
  text: 'text',
}

/** 展示名长度上限（与 `manager.cleanName` 同一条 256）。 */
const LIBRARY_NAME_MAX_LENGTH = 256

/** 一次文本导入的输入。 */
export interface LibraryTextImportInput {
  /** 展示名（带扩展名；扩展名决定格式）。 */
  readonly name: string
  /** 文本正文（浏览器读到的原文，可含 `\r\n`）。 */
  readonly content: string
  readonly parentId?: string | null | undefined
  readonly source?: LibraryAssetSource | undefined
}

/** 一次文本导入的结果（路由与工具据此投影）。 */
export interface LibraryTextImportResult {
  readonly asset: LibraryAssetRecord
  readonly revision: LibraryRevisionRecord
}

/** 从展示名判格式；不认识的扩展名一律 400（绝不"猜一个"或降级成未知格式）。 */
export function libraryTextKindOf(name: unknown): LibraryAssetKind {
  if (typeof name !== 'string' || name.length === 0) throw badRequest('name must be a non-empty string')
  if (name.length > LIBRARY_NAME_MAX_LENGTH) throw badRequest(`name must be at most ${LIBRARY_NAME_MAX_LENGTH} characters`)
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const kind = LIBRARY_TEXT_EXTENSIONS[extension]
  if (kind === undefined) {
    throw badRequest('library accepts markdown (.md/.markdown) and text (.txt/.text) files only')
  }
  return kind
}

/** 方案 §4.1 F3 的 md/txt 转换口径：`\r\n?`→`\n`（别的字符一个不动，不做 Markdown 解析）。 */
export function normalizeLibraryText(text: string): string {
  return text.replace(/\r\n?/gu, '\n')
}

/**
 * 导入一份文本资料。
 *
 * 顺序：判格式 → 原件字节（原文 UTF-8，保留 `\r\n`）→ 建资产 → 写修订（派生正文用归一化文本 +
 * `conversion.json`，故 `conversionStatus` 是 `ready`）。**失败补偿**：修订没落成就把刚建的空资产删掉，
 * 不留一个"看得见但打不开"的空壳（这正是本仓对静默半成品的要求）。
 *
 * @param manager - 本主体的服务门面。
 * @param input - 展示名 / 正文 / 可选父节点与来源。
 * @returns 落盘后的资产与第一条修订。
 * @throws {LibraryError} `library/invalid-request`（名字/正文形状或扩展名不认）、
 *   `library/file-too-large`（原件 > 50 MiB 或正文 > 8 MiB）、`library/invalid-text`（夹 NUL）。
 */
export async function importLibraryText(
  manager: LibraryManager,
  input: LibraryTextImportInput,
): Promise<LibraryTextImportResult> {
  const kind = libraryTextKindOf(input?.name)
  if (typeof input?.content !== 'string') throw badRequest('content must be a string')
  const original = Buffer.from(input.content, 'utf8')
  const content = normalizeLibraryText(input.content)
  const asset = await manager.createAsset({
    name: input.name,
    kind,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    ...(input.source === undefined ? {} : { source: input.source }),
  })
  try {
    const revision = await manager.writeRevision({
      assetId: asset.id,
      original,
      content,
      conversion: {
        version: 1,
        kind,
        originalSha256: createHash('sha256').update(original).digest('hex'),
        warnings: [],
        locations: [],
      },
    })
    return { asset, revision }
  } catch (error) {
    // 补偿：修订没落成 ⇒ 这次导入当作从未发生（空壳资产一并删掉；删不掉只留痕，不掩盖原始失败）。
    try {
      await manager.removeAsset(asset.id)
    } catch (cleanupError) {
      manager.reportCleanupFailure('library import compensation failed', cleanupError)
    }
    throw error
  }
}
