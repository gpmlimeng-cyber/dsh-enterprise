/**
 * [INPUT]: 只依赖 `./decode-primitives.js` 的严格解码内核（record/hasExactKeys/nonEmptyString/timestamp 与唯一的 `EnterpriseLocalApiError`）；不依赖 fetch、React 与任何宿主面
 * [OUTPUT]: 资料库契约分片——四份 DTO（目录 `EnterpriseLibrarySpace`、导入回执 `EnterpriseLibraryImportResult`、检索命中 `EnterpriseLibraryHit`、正文 `EnterpriseLibraryText`）与四个严格解码器 `decodeEnterpriseLibrary{Space,Import,Hits,Text}`，以及四份**键集常量**供漂移门禁比对
 * [POS]: dsh-ui 浏览器取数契约层的资料库分片（与 `skill-api-decode.ts` 同一手法：本文件是唯一 DTO 真源、`local-api-decode.ts` 原样再导出）。形状真源是 Host 的 `bundle/src/library/route.ts` 四个投影函数：**未知键一律判畸形**（Host 多塞主体、宿主路径或正文以外的任何东西都进不了界面），时间戳必须是 RFC 3339，id 与格式都按本仓形状收窄
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterpriseLocalApiError, hasExactKeys, nonEmptyString, record, timestamp, type JsonRecord } from './decode-primitives.js'

/** 本仓资料库的 id 形状（`nd_…`/`as_…`/`rv_…`；不含 `/`、`.`、`%`，因此界面拿到它拼不出路径）。 */
const LIBRARY_ID = /^[A-Za-z0-9_-]{1,128}$/

/** 六种格式（与 Host 的 `LIBRARY_ASSET_KINDS` 同集合）。 */
export const ENTERPRISE_LIBRARY_KINDS = ['markdown', 'text', 'pdf', 'docx', 'pptx', 'html'] as const
export type EnterpriseLibraryKind = (typeof ENTERPRISE_LIBRARY_KINDS)[number]

/** 三种来源（员工上传 / 会话交付 / 其他工具写入）。 */
export const ENTERPRISE_LIBRARY_SOURCES = ['upload', 'task', 'created'] as const
export type EnterpriseLibraryAssetSource = (typeof ENTERPRISE_LIBRARY_SOURCES)[number]

/** 三种转换状态（就绪 / 转换中 / 转换失败）。 */
export const ENTERPRISE_LIBRARY_CONVERSION_STATES = ['ready', 'pending', 'failed'] as const
export type EnterpriseLibraryConversionState = (typeof ENTERPRISE_LIBRARY_CONVERSION_STATES)[number]

/** 目录节点的键集（必填键，**恰好**这些）。 */
export const ENTERPRISE_LIBRARY_NODE_KEYS = ['id', 'parentId', 'kind', 'title', 'assetId', 'createdAt', 'updatedAt'] as const
/** 资产的键集（必填键，**恰好**这些）。 */
export const ENTERPRISE_LIBRARY_ASSET_KEYS = [
  'id', 'name', 'kind', 'mediaType', 'byteLength', 'currentRevisionId', 'status', 'source', 'createdAt', 'updatedAt',
] as const
/** 修订的键集（必填键，**恰好**这些）。 */
export const ENTERPRISE_LIBRARY_REVISION_KEYS = [
  'id', 'assetId', 'number', 'originalByteLength', 'contentByteLength', 'conversionStatus', 'createdAt',
] as const
/** 检索命中的键集（必填键 + 一个可选的 `location`）。 */
export const ENTERPRISE_LIBRARY_HIT_KEYS = [
  'assetId', 'revisionId', 'name', 'kind', 'source', 'updatedAt', 'folderPath', 'excerpt',
] as const
export const ENTERPRISE_LIBRARY_HIT_OPTIONAL_KEYS = ['location'] as const
/** 正文回执的键集（必填键，**恰好**这些）。 */
export const ENTERPRISE_LIBRARY_TEXT_KEYS = ['assetId', 'revisionId', 'name', 'kind', 'content', 'byteLength'] as const

/** 目录里的一棵树节点（文件夹与文件共用）。 */
export interface EnterpriseLibraryNode {
  readonly id: string
  readonly parentId: string | null
  readonly kind: 'folder' | 'asset'
  readonly title: string
  readonly assetId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

/** 一份资料（树上的"文件"）。 */
export interface EnterpriseLibraryAsset {
  readonly id: string
  readonly name: string
  readonly kind: EnterpriseLibraryKind
  readonly mediaType: string
  readonly byteLength: number
  readonly currentRevisionId: string | null
  readonly status: 'active' | 'disabled'
  readonly source: EnterpriseLibraryAssetSource
  readonly createdAt: string
  readonly updatedAt: string
}

/** 一条修订的元数据（正文不在其中：正文只走 `readText`）。 */
export interface EnterpriseLibraryRevision {
  readonly id: string
  readonly assetId: string
  readonly number: number
  readonly originalByteLength: number
  readonly contentByteLength: number
  readonly conversionStatus: EnterpriseLibraryConversionState
  readonly createdAt: string
}

/** 整库目录：根标题 + 全部节点 + 全部资产（界面自己拼树，服务端不预拼路径）。 */
export interface EnterpriseLibrarySpace {
  readonly rootTitle: string
  readonly nodes: readonly EnterpriseLibraryNode[]
  readonly assets: readonly EnterpriseLibraryAsset[]
}

/** 一次导入的回执。 */
export interface EnterpriseLibraryImportResult {
  readonly asset: EnterpriseLibraryAsset
  readonly revision: EnterpriseLibraryRevision
}

/** 一条检索命中。 */
export interface EnterpriseLibraryHit {
  readonly assetId: string
  readonly revisionId: string
  readonly name: string
  readonly kind: EnterpriseLibraryKind
  readonly source: EnterpriseLibraryAssetSource
  readonly updatedAt: string
  /** 可读的文件夹路径（`我的资料 / 项目甲`）。 */
  readonly folderPath: string
  /** 命中位置之前的最后一个标题（没有就不出这个键）。 */
  readonly location?: string
  readonly excerpt: string
}

/** 一份资料的正文回执。 */
export interface EnterpriseLibraryText {
  readonly assetId: string
  readonly revisionId: string
  readonly name: string
  readonly kind: EnterpriseLibraryKind
  readonly content: string
  readonly byteLength: number
}

function fail(): never {
  throw new EnterpriseLocalApiError('ENT_LOCAL_RESPONSE_INVALID')
}

function requireRecord(value: unknown): JsonRecord {
  const view = record(value)
  if (view === undefined) fail()
  return view
}

function requireId(value: unknown): string {
  if (typeof value !== 'string' || !LIBRARY_ID.test(value)) fail()
  return value
}

function requireNullableId(value: unknown): string | null {
  return value === null ? null : requireId(value)
}

function requireKind(value: unknown): EnterpriseLibraryKind {
  if (typeof value !== 'string' || !(ENTERPRISE_LIBRARY_KINDS as readonly string[]).includes(value)) fail()
  return value as EnterpriseLibraryKind
}

function requireCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail()
  return value
}

function requireTimestamp(value: unknown): string {
  if (!timestamp(value)) fail()
  return value
}

function requireText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) fail()
  return value
}

/** 目录节点解码。 */
export function decodeEnterpriseLibraryNode(value: unknown): EnterpriseLibraryNode {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ENTERPRISE_LIBRARY_NODE_KEYS)) fail()
  const kind = view['kind']
  if (kind !== 'folder' && kind !== 'asset') fail()
  const assetId = requireNullableId(view['assetId'])
  // 两种节点的自洽性：文件夹没有资产、文件节点必有资产（Host 的建树不变量）。
  if (kind === 'folder' && assetId !== null) fail()
  if (kind === 'asset' && assetId === null) fail()
  return {
    id: requireId(view['id']),
    parentId: requireNullableId(view['parentId']),
    kind,
    title: requireText(view['title'], 256),
    assetId,
    createdAt: requireTimestamp(view['createdAt']),
    updatedAt: requireTimestamp(view['updatedAt']),
  }
}

/** 资产解码。 */
export function decodeEnterpriseLibraryAsset(value: unknown): EnterpriseLibraryAsset {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ENTERPRISE_LIBRARY_ASSET_KEYS)) fail()
  const status = view['status']
  if (status !== 'active' && status !== 'disabled') fail()
  const source = view['source']
  if (typeof source !== 'string' || !(ENTERPRISE_LIBRARY_SOURCES as readonly string[]).includes(source)) fail()
  if (!nonEmptyString(view['mediaType'])) fail()
  return {
    id: requireId(view['id']),
    name: requireText(view['name'], 256),
    kind: requireKind(view['kind']),
    mediaType: view['mediaType'],
    byteLength: requireCount(view['byteLength']),
    currentRevisionId: requireNullableId(view['currentRevisionId']),
    status,
    source: source as EnterpriseLibraryAssetSource,
    createdAt: requireTimestamp(view['createdAt']),
    updatedAt: requireTimestamp(view['updatedAt']),
  }
}

/** 修订解码。 */
export function decodeEnterpriseLibraryRevision(value: unknown): EnterpriseLibraryRevision {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ENTERPRISE_LIBRARY_REVISION_KEYS)) fail()
  const conversion = view['conversionStatus']
  if (typeof conversion !== 'string' || !(ENTERPRISE_LIBRARY_CONVERSION_STATES as readonly string[]).includes(conversion)) fail()
  if (typeof view['number'] !== 'number' || !Number.isInteger(view['number']) || view['number'] < 1) fail()
  return {
    id: requireId(view['id']),
    assetId: requireId(view['assetId']),
    number: view['number'],
    originalByteLength: requireCount(view['originalByteLength']),
    contentByteLength: requireCount(view['contentByteLength']),
    conversionStatus: conversion as EnterpriseLibraryConversionState,
    createdAt: requireTimestamp(view['createdAt']),
  }
}

/** 目录解码（`space` 的 `{data}`）。 */
export function decodeEnterpriseLibrarySpace(value: unknown): EnterpriseLibrarySpace {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ['rootTitle', 'nodes', 'assets'])) fail()
  const nodes = view['nodes']
  const assets = view['assets']
  if (!Array.isArray(nodes) || !Array.isArray(assets)) fail()
  if (!nonEmptyString(view['rootTitle']) || view['rootTitle'].length > 64) fail()
  return {
    rootTitle: view['rootTitle'],
    nodes: nodes.map(decodeEnterpriseLibraryNode),
    assets: assets.map(decodeEnterpriseLibraryAsset),
  }
}

/** 导入回执解码（`import` 的 `{data}`）。 */
export function decodeEnterpriseLibraryImport(value: unknown): EnterpriseLibraryImportResult {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ['asset', 'revision'])) fail()
  return {
    asset: decodeEnterpriseLibraryAsset(view['asset']),
    revision: decodeEnterpriseLibraryRevision(view['revision']),
  }
}

/** 检索命中解码（`search` 的 `{data}`）。 */
export function decodeEnterpriseLibraryHits(value: unknown): readonly EnterpriseLibraryHit[] {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ['hits'])) fail()
  const hits = view['hits']
  if (!Array.isArray(hits) || hits.length > 50) fail()
  return hits.map(entry => {
    const hit = requireRecord(entry)
    if (!hasExactKeys(hit, ENTERPRISE_LIBRARY_HIT_KEYS, ENTERPRISE_LIBRARY_HIT_OPTIONAL_KEYS)) fail()
    const source = hit['source']
    if (typeof source !== 'string' || !(ENTERPRISE_LIBRARY_SOURCES as readonly string[]).includes(source)) fail()
    const location = hit['location']
    if (location !== undefined && (typeof location !== 'string' || location.length > 256)) fail()
    return {
      assetId: requireId(hit['assetId']),
      revisionId: requireId(hit['revisionId']),
      name: requireText(hit['name'], 256),
      kind: requireKind(hit['kind']),
      source: source as EnterpriseLibraryAssetSource,
      updatedAt: requireTimestamp(hit['updatedAt']),
      folderPath: requireText(hit['folderPath'], 1024),
      ...(location === undefined ? {} : { location }),
      excerpt: requireText(hit['excerpt'], 512),
    }
  })
}

/** 正文解码（`read-text` 的 `{data}`）。 */
export function decodeEnterpriseLibraryText(value: unknown): EnterpriseLibraryText {
  const view = requireRecord(value)
  if (!hasExactKeys(view, ENTERPRISE_LIBRARY_TEXT_KEYS)) fail()
  return {
    assetId: requireId(view['assetId']),
    revisionId: requireId(view['revisionId']),
    name: requireText(view['name'], 256),
    kind: requireKind(view['kind']),
    // 正文上限与 Host 的"单份正文 8 MiB"同一条：UTF-16 码元数不可能超过字节数，故 8 MiB 是安全上界。
    content: requireText(view['content'], 8 * 1024 * 1024),
    byteLength: requireCount(view['byteLength']),
  }
}
