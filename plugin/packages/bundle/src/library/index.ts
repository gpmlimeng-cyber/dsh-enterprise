/**
 * [INPUT]: 只依赖本目录与 `./storage/*` 下的模块（不 import 任何 `@deepseek-ai/*`、不 import `../../index.js`）
 * [OUTPUT]: 把本刀的公开面收在一处：错误码与 `LibraryError`、主键层、记录信封、域规格与四张表 schema/类型、对象层与转换元数据、`LibraryManager` 服务门面
 * [POS]: bundle 资料库纵深（P0 第一块基石：存储与域层）的**本地出口**。**本刀刻意不接线**：`bundle/src/index.ts` 里没有一行 import 它，`bundle/cordis.patch.yml` 不动，`contracts/` 不动，`ui/` 不动——因此它现在只是"可被单测直接 import 的纯模块"，宿主运行期完全看不到它（方案 §5.1 的 P0 竖切把它拆成多刀，本刀是第一刀）
 * [PROTOCOL]: 下一刀（宿主接线）在这里或 `../../index.ts` 增加挂载点，并更新本头部
 */

// 稳定错误码与错误类型
export { LibraryError, badRequest, libraryError, type LibraryErrorCode } from './errors.js'
// 主键层（纯函数）
export {
  foldLibraryKey,
  isLibraryKeySafe,
  libraryRecordKey,
  normalizeLibraryKey,
  sanitizeLibraryKeyPart,
  LIBRARY_KEY_MAX_LENGTH,
  LIBRARY_KEY_SEPARATOR,
  LIBRARY_SAFE_KEY_PATTERN,
  LIBRARY_UNIT_NAME_PATTERN,
  type LibraryKeyTriple,
} from './storage/keys.js'
// per-record 记录信封
export {
  decodeRecordEnvelope,
  encodeRecordEnvelope,
  LIBRARY_RECORD_ENVELOPE_VERSION,
  type LibraryRecordEnvelope,
} from './storage/records.js'
// 域规格与四张表
export {
  assertLibraryDomainSpec,
  parseLibraryRecord,
  LIBRARY_ASSET_KINDS,
  LIBRARY_DEFAULT_EXTENSIONS,
  LIBRARY_DEFAULT_MEDIA_TYPES,
  LIBRARY_DOMAIN_NAME,
  LIBRARY_DOMAIN_TABLE_NAMES,
  LIBRARY_DOMAIN_VERSION,
  LIBRARY_MAX_SELECTION_NODES,
  LIBRARY_ROOT_TITLE,
  LIBRARY_TABLE_SCHEMAS,
  libraryAssetSchema,
  libraryDomainSpec,
  libraryNodeSchema,
  libraryRevisionSchema,
  librarySelectionSchema,
  type LibraryAssetRecord,
  type LibraryDomainPort,
  type LibraryDomainSpec,
  type LibraryNodeRecord,
  type LibraryRevisionRecord,
  type LibrarySelectionRecord,
  type LibraryTableName,
  type LibraryTablePort,
  type LibraryTableRecords,
  type LibraryTableSpec,
} from './storage/domain.js'
// 对象层（不可变原件 + 转换元数据）
export {
  decodeConversionRecord,
  defaultLibraryExtension,
  encodeConversionRecord,
  LibraryObjectStore,
  libraryConversionSchema,
  LIBRARY_CONTENT_FILENAME,
  LIBRARY_CONVERSION_FILENAME,
  LIBRARY_MAX_CONVERSION_BYTES,
  LIBRARY_MAX_ORIGINAL_BYTES,
  LIBRARY_MAX_TEXT_BYTES,
  LIBRARY_OBJECTS_DIR_SEGMENTS,
  type LibraryConversionRecord,
  type LibraryObjectStoreOptions,
  type LibraryObjectStorePort,
  type LibraryRevisionObjects,
  type LibraryRevisionOriginal,
  type LibraryRevisionText,
  type LibraryRevisionWriteInput,
} from './objects.js'
// 服务门面
export {
  LibraryManager,
  LIBRARY_DEFAULT_LIMITS,
  type LibraryAssetKind,
  type LibraryAssetSource,
  type LibraryAssetStatus,
  type LibraryCreateAssetInput,
  type LibraryCreateFolderInput,
  type LibraryIdKind,
  type LibraryLimits,
  type LibraryManagerOptions,
  type LibraryRemovalSummary,
  type LibraryRevisionDocument,
  type LibraryRevisionOriginalContent,
  type LibrarySubject,
  type LibraryWriteRevisionInput,
} from './manager.js'
