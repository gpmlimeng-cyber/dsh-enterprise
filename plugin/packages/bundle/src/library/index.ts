/**
 * [INPUT]: 只依赖本目录与 `./storage/*` 下的模块（唯一的例外是 `./route.js` 与 `./host.js`：它们要用 platform-client 的 route port 与 `resolveEnterpriseDshHome()`；**仍不 import 官方 `@deepseek-ai/*`**）
 * [OUTPUT]: 把资料库纵深的公开面收在一处：错误码与 `LibraryError`、主键层、记录信封、域规格与五张表 schema/类型、对象层与转换元数据、`LibraryManager` 服务门面、检索纯函数、文本导入、本机路由、Host 工具、system-prompt 注入与宿主装配
 * [POS]: bundle 资料库纵深的**本地出口**。第一刀（存储与域层）刻意不接线，本刀（宿主接线）把三个面挂上：`bundle/src/index.ts` 的 `apply()` 调一次 `createEnterpriseLibraryHost` + `mountEnterpriseLibraryFaces`；`bundle/cordis.patch.yml` 与 `contracts/` 仍然不动
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
// 域规格与五张表
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
  libraryDraftSchema,
  libraryNodeSchema,
  libraryRevisionSchema,
  librarySelectionSchema,
  type LibraryAssetRecord,
  type LibraryDomainPort,
  type LibraryDomainSpec,
  type LibraryDraftRecord,
  type LibraryNodeRecord,
  type LibraryRevisionRecord,
  type LibrarySelectionRecord,
  type LibraryTableName,
  type LibraryTablePort,
  type LibraryTableRecords,
  type LibraryTableSpec,
} from './storage/domain.js'
// 对象层（不可变原件 + 可变草稿正文 + 转换元数据）
export {
  decodeConversionRecord,
  defaultLibraryExtension,
  encodeConversionRecord,
  LibraryDraftObjectStore,
  LibraryObjectStore,
  libraryConversionSchema,
  LIBRARY_CONTENT_FILENAME,
  LIBRARY_CONVERSION_FILENAME,
  LIBRARY_DRAFT_CONTENT_SUFFIX,
  LIBRARY_DRAFTS_DIR_SEGMENTS,
  LIBRARY_MAX_CONVERSION_BYTES,
  LIBRARY_MAX_ORIGINAL_BYTES,
  LIBRARY_MAX_TEXT_BYTES,
  LIBRARY_OBJECTS_DIR_SEGMENTS,
  type LibraryConversionRecord,
  type LibraryDraftContent,
  type LibraryDraftObjectPort,
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
  type LibraryCreateDraftInput,
  type LibraryCreateFolderInput,
  type LibraryDraftDocument,
  type LibraryIdKind,
  type LibraryLimits,
  type LibraryManagerOptions,
  type LibraryRemovalSummary,
  type LibraryRevisionDocument,
  type LibraryRevisionOriginalContent,
  type LibrarySearchHit,
  type LibrarySearchInput,
  type LibrarySelectionItem,
  type LibrarySubject,
  type LibraryWriteRevisionInput,
} from './manager.js'
// 检索语义（纯函数）
export {
  LIBRARY_SEARCH_EXCERPT_LENGTH,
  LIBRARY_SEARCH_EXCERPT_LEAD,
  LIBRARY_SEARCH_LIMIT,
  compareLibrarySearchHits,
  librarySearchExcerpt,
  librarySearchLocation,
  librarySearchMatch,
  librarySearchTerm,
  type LibrarySearchHit as LibrarySearchHitShape,
} from './search.js'
// 文本导入（md/txt）
export {
  importLibraryText,
  libraryTextKindOf,
  normalizeLibraryText,
  type LibraryTextImportInput,
  type LibraryTextImportResult,
} from './import.js'
// 本机 HTTP 面
export {
  ENTERPRISE_LIBRARY_ENDPOINTS,
  ENTERPRISE_LIBRARY_LOCAL_PATH,
  ENTERPRISE_LIBRARY_MAX_BODY_BYTES,
  ENTERPRISE_LIBRARY_OBJECTS_PREFIX,
  projectLibraryFailure,
  registerEnterpriseLibraryRoutes,
  type EnterpriseLibraryEndpoint,
  type EnterpriseLibraryRoutePort,
  type LibraryFailureProjection,
} from './route.js'
// 模型面：Host 工具
export {
  ENTERPRISE_LIBRARY_TOOL_NAMES,
  LIBRARY_READ_DEFAULT_LIMIT,
  LIBRARY_READ_MAX_LIMIT,
  libraryReadWindow,
  librarySearchToolValue,
  registerEnterpriseLibraryTools,
  type EnterpriseLibraryToolContent,
  type EnterpriseLibraryToolDefinition,
  type EnterpriseLibraryToolExec,
  type EnterpriseLibraryToolPort,
  type EnterpriseLibraryToolRuntime,
} from './tools.js'
// 模型面：system-prompt 注入
export {
  LIBRARY_INJECTION_CONTEXT_NAME,
  LIBRARY_INJECTION_DEFENSE,
  LIBRARY_INJECTION_DOCUMENT_LIMIT,
  LIBRARY_INJECTION_TOTAL_LIMIT,
  buildLibraryInjectionText,
  librarySessionIdOf,
  registerEnterpriseLibraryInjection,
  renderLibraryDocument,
  type EnterpriseLibraryEventPort,
  type EnterpriseLibraryInjectionPort,
  type LibraryAssembleContext,
  type LibraryAssembleListener,
  type LibraryAssembleNext,
  type LibraryPromptAssembly,
  type LibraryPromptContextEntry,
} from './context-injection.js'
// 宿主装配
export {
  createEnterpriseLibraryHost,
  mountEnterpriseLibraryFaces,
  type EnterpriseLibraryDomainFacilityPort,
  type EnterpriseLibraryHost,
  type EnterpriseLibraryHostDeps,
} from './host.js'
