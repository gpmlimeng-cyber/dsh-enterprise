/**
 * [INPUT]: 依赖 Node fs/crypto/path 的原子缓存读写、installation 的 DSH_HOME 解析、平台 origin 与组合层注入的 fetch
 * [OUTPUT]: 提供 EnterpriseBrandingCache（免登录取数、revision 去重、`string | { url }` 双形 LOGO 槽位解析、位图白名单与尺寸上限、磁盘资源副本、浏览器投影）与品牌本地路由路径常量
 * [POS]: platform-client 的品牌数据边界，唯一读取远端 LOGO 的代码路径；同 revision 用远端声明补齐旧版 Host 漏掉的副本，一切失败都降级为「没有企业品牌」，内置默认由 ui 侧持有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveEnterpriseDshHome } from './installation.js'

/** 企业公开只读品牌接口；B1 期由服务端提供，未上线时按「不存在」处理。 */
export const BRANDING_REMOTE_PATH = '/enterprise/api/v1/branding'
/** 本地只读品牌路由；local-api.ts 用同一对常量注册，避免两处各写一份路径字面量。 */
export const BRANDING_LOCAL_PATH = '/enterprise/api/v1/local/branding'
export const BRANDING_ASSET_LOCAL_PATH = `${BRANDING_LOCAL_PATH}/asset`

/** 单个 LOGO 的尺寸上限（规划 §6：限尺寸、限类型）。 */
export const BRANDING_MAX_ASSET_BYTES = 512 * 1024
/** 短超时：品牌不是关键路径，取不到就用缓存或内置默认。 */
export const BRANDING_TIMEOUT_MS = 3_000
export const BRANDING_ASSET_SLOTS = ['light', 'dark', 'square'] as const
export type BrandingAssetSlot = typeof BRANDING_ASSET_SLOTS[number]

/**
 * 资源白名单只收位图。SVG 可以携带脚本与远端引用，在拿不出可信消毒器的前提下整体拒绝
 * （规划 §6 的处置之一：宁可没有 LOGO，也不引入脚本面）。
 */
const BRANDING_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
/** 缓存目录里的合法文件名：槽位 - revision . 扩展名，杜绝路径拼接逃逸。 */
const BRANDING_ASSET_FILE = /^(?:light|dark|square)-\d{1,19}\.(?:png|jpg|webp|gif)$/
const BRANDING_CACHE_FILE = 'branding.json'
const BRANDING_CACHE_DIRECTORY = 'branding'
const BRANDING_MAX_REFERENCE_LENGTH = 2048

/** 服务端品牌白名单字段（契约真源见 docs/branding-customization-plan.md §3）。 */
export interface EnterpriseBrandingLogoSet {
  readonly light: string | null
  readonly dark: string | null
  readonly square: string | null
}

export interface EnterpriseBrandingWelcome {
  readonly headline: string
  readonly editionLabel: string
}

export interface EnterpriseBrandingDocument {
  readonly revision: number
  readonly name: string
  readonly shortName: string
  readonly logo: EnterpriseBrandingLogoSet
  readonly welcome: EnterpriseBrandingWelcome
  readonly updatedAt: string
}

export interface EnterpriseBrandingAsset {
  readonly contentType: string
  readonly bytes: Buffer
}

/** 浏览器侧唯一的品牌读取端口；没有品牌时 `document()` 是 null，由 ui 回落内置默认。 */
export interface EnterpriseBrandingPort {
  document(): Promise<EnterpriseBrandingDocument | null>
  asset(slot: BrandingAssetSlot): Promise<EnterpriseBrandingAsset | undefined>
}

/** 磁盘缓存条目：文件副本名与它的字节类型。 */
interface BrandingAssetRecord {
  readonly file: string
  readonly contentType: string
}

interface CachedBranding extends EnterpriseBrandingDocument {
  readonly assets: Partial<Record<BrandingAssetSlot, BrandingAssetRecord>>
}

export interface EnterpriseBrandingCacheOptions {
  /** 组合层当前生效的平台 origin；未配置时返回 undefined，此时不发任何请求。 */
  readonly serverUrl: () => URL | undefined
  readonly fetch: (input: URL, init: RequestInit) => Promise<Response>
  readonly dshHome?: string | undefined
  readonly timeoutMs?: number
  /** 失败留痕端口；品牌故障永远只是降级，不影响任何界面。 */
  readonly onFailure?: (operation: string, error: unknown) => void
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 契约里的文本字段：超长、非字符串或空白一律当「没有」，交给 ui 逐字段回落。 */
function brandingText(value: unknown, max: number): string {
  return typeof value === 'string' && value.length <= max ? value.trim() : ''
}

/**
 * LOGO 槽位在线上有两种形状：裸字符串，与契约真源
 * `contracts/components/branding.yaml#/BrandingAssetRef` 的 `{ url, sha256, contentType, width, height, sizeBytes }`。
 * 这里只取 `url` 并忽略其余字段与未知字段——声明里的 sha256/sizeBytes 不充当门禁，
 * 实际字节始终以响应的 MIME 头与下载长度为准。
 */
function brandingLogoUrl(value: unknown): string | null {
  const source = record(value)
  if (source === undefined) return null
  const url = source['url']
  return typeof url === 'string' ? url : null
}

/** LOGO 引用先过结构检查；同源约束在下载前按平台 origin 再判一次。 */
function brandingLogoReference(value: unknown): string | null {
  const raw = typeof value === 'string' ? value : brandingLogoUrl(value)
  if (raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.length > BRANDING_MAX_REFERENCE_LENGTH) return null
  // 控制字符会把路径与响应头搅乱，直接当非法引用丢弃。
  return /[\u0000-\u001f\u007f]/.test(trimmed) ? null : trimmed
}

function brandingAssetFileName(slot: BrandingAssetSlot, revision: number, extension: string): string {
  return `${slot}-${revision}.${extension}`
}

/**
 * 解析服务端品牌响应，同时容忍裸契约体与 `{ data: … }` 信封。
 * 未知字段忽略（B1 后续加字段不该让整份品牌失效），单字段不合法只丢该字段。
 *
 * @param value - 响应 JSON 或缓存的 JSON。
 * @returns revision 合法时的文档；否则 undefined（视为没有品牌）。
 */
export function parseEnterpriseBranding(value: unknown): EnterpriseBrandingDocument | undefined {
  const outer = record(value)
  if (outer === undefined) return undefined
  const source = Number.isSafeInteger(outer['revision']) ? outer : record(outer['data'])
  if (source === undefined) return undefined
  const revision = source['revision']
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) return undefined
  const logo = record(source['logo']) ?? {}
  const welcome = record(source['welcome']) ?? {}
  return {
    revision: revision as number,
    name: brandingText(source['name'], 120),
    shortName: brandingText(source['shortName'], 120),
    logo: {
      light: brandingLogoReference(logo['light']),
      dark: brandingLogoReference(logo['dark']),
      square: brandingLogoReference(logo['square']),
    },
    welcome: {
      headline: brandingText(welcome['headline'], 200),
      editionLabel: brandingText(welcome['editionLabel'], 40),
    },
    updatedAt: brandingText(source['updatedAt'], 64),
  }
}

/** 缓存文件是我们自己的记录（文档 + 资源副本名）；损坏即当没有缓存。 */
function parseCachedBranding(value: unknown): CachedBranding | undefined {
  const document = parseEnterpriseBranding(value)
  if (document === undefined) return undefined
  const assets: Partial<Record<BrandingAssetSlot, BrandingAssetRecord>> = {}
  const source = record(value)
  const cached = record(source?.['assets'])
  for (const slot of BRANDING_ASSET_SLOTS) {
    const entry = record(cached?.[slot])
    const file = entry?.['file']
    const contentType = entry?.['contentType']
    if (typeof file !== 'string' || typeof contentType !== 'string') continue
    const extension = BRANDING_MIME_EXTENSIONS[contentType]
    if (extension === undefined || !BRANDING_ASSET_FILE.test(file)) continue
    if (file !== brandingAssetFileName(slot, document.revision, extension)) continue
    assets[slot] = { file, contentType }
  }
  return { ...document, assets }
}

/**
 * 把 LOGO 引用收敛到平台 origin 内的 HTTP(S) 地址。
 * 服务端给出的绝对外站地址一律拒绝：Host 不去替服务端拉任何第三方资源（同类 SSRF 边界）。
 *
 * @param reference - 契约里的 LOGO 引用，可相对可绝对。
 * @param baseUrl - 当前平台 origin。
 * @returns 可下载的同源地址；越界或非法时 undefined。
 */
export function resolveBrandingAssetUrl(reference: string, baseUrl: URL): URL | undefined {
  try {
    const url = new URL(reference, baseUrl)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:')) return undefined
    if (url.origin !== baseUrl.origin || url.username !== '' || url.password !== '') return undefined
    return url
  } catch {
    return undefined
  }
}

/** 逐块读取响应并在超过上限时立刻放弃，避免用一个 Content-Length 谎言撑爆内存。 */
async function readCapped(response: Response, limit: number): Promise<Buffer | undefined> {
  const body = response.body
  if (body === null) return undefined
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done === true) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return undefined
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

/**
 * 企业品牌的 Host 侧取数与缓存。
 *
 * 一次性语义：只在 Host 启动、切换 Server 与登录成功后各拉一次，不轮询、不建立 SSE。
 * 任何失败（接口不存在、未配置、离线、解析失败、超时、资源非法）都只是保持现状或退回
 * 「没有企业品牌」，绝不抛出到调用方——登录弹窗是未登录时唯一可见界面，不能被品牌阻断。
 */
export class EnterpriseBrandingCache implements EnterpriseBrandingPort {
  private readonly cachePath: string
  private readonly cacheDirectory: string
  private readonly timeoutMs: number
  private readonly ready: Promise<void>
  private current: CachedBranding | undefined
  private pending: Promise<void> | undefined
  private disposed = false

  constructor(private readonly options: EnterpriseBrandingCacheOptions) {
    const dshHome = options.dshHome === undefined ? {} : { dshHome: options.dshHome }
    const home = resolveEnterpriseDshHome(dshHome)
    this.cacheDirectory = join(home, 'enterprise', BRANDING_CACHE_DIRECTORY)
    this.cachePath = join(home, 'enterprise', BRANDING_CACHE_FILE)
    this.timeoutMs = options.timeoutMs ?? BRANDING_TIMEOUT_MS
    this.ready = this.load()
  }

  /** 启动时读一次磁盘副本；离线冷启动因此仍能给出上一次的品牌。 */
  private async load(): Promise<void> {
    try {
      const cached = parseCachedBranding(JSON.parse(await readFile(this.cachePath, 'utf8')))
      if (cached !== undefined && !this.disposed) this.current = cached
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.fail('cache-read', error)
    }
  }

  /** 浏览器投影：LOGO 换成同源本地地址，且只在该副本确实存在时给出。 */
  async document(): Promise<EnterpriseBrandingDocument | null> {
    await this.ready
    const current = this.current
    if (current === undefined) return null
    return {
      revision: current.revision,
      name: current.name,
      shortName: current.shortName,
      logo: {
        light: this.localAssetUrl('light', current),
        dark: this.localAssetUrl('dark', current),
        square: this.localAssetUrl('square', current),
      },
      welcome: { headline: current.welcome.headline, editionLabel: current.welcome.editionLabel },
      updatedAt: current.updatedAt,
    }
  }

  async asset(slot: BrandingAssetSlot): Promise<EnterpriseBrandingAsset | undefined> {
    await this.ready
    const asset = this.current?.assets[slot]
    if (asset === undefined) return undefined
    try {
      return { contentType: asset.contentType, bytes: await readFile(join(this.cacheDirectory, asset.file)) }
    } catch (error) {
      this.fail(`asset-read:${slot}`, error)
      return undefined
    }
  }

  /**
   * 拉一次品牌并落盘。并发调用共享同一任务；未配置 Server 时什么都不做。
   * 本方法永不 reject。
   */
  async refresh(): Promise<void> {
    if (this.disposed) return
    const baseUrl = this.options.serverUrl()
    if (baseUrl === undefined) return
    if (this.pending !== undefined) return this.pending
    const task = this.run(baseUrl).catch(error => { this.fail('refresh', error) })
    this.pending = task
    try {
      await task
    } finally {
      if (this.pending === task) this.pending = undefined
    }
  }

  /** 停止后续刷新；已落盘的副本保留，下一次启动仍可用。 */
  dispose(): void {
    this.disposed = true
  }

  private localAssetUrl(slot: BrandingAssetSlot, current: CachedBranding): string | null {
    return current.assets[slot] === undefined
      ? null
      : `${BRANDING_ASSET_LOCAL_PATH}/${slot}?v=${current.revision}`
  }

  private async run(baseUrl: URL): Promise<void> {
    const payload = await this.fetchJson(baseUrl)
    const document = parseEnterpriseBranding(payload)
    if (document === undefined) throw new Error('branding payload is invalid')
    const cached = this.current
    if (cached !== undefined && cached.revision === document.revision) {
      // revision 就是内容身份：同 revision 不重发、不覆盖任何文档字段。
      // 只有资源副本缺失时才补一次（地址失效、磁盘被清，或旧版 Host 曾把对象形 LOGO 误判成
      // 「没有 LOGO」而落下一份空副本的缓存）——声明以本次远端文档为准，副本只补不覆盖，故能自愈。
      if (this.assetsComplete(cached, document.logo)) return
      const repaired = await this.completeAssets(cached, document.logo, baseUrl)
      await this.publish(repaired)
      return
    }
    const next: CachedBranding = { ...document, assets: await this.downloadAssets(document, baseUrl) }
    await this.publish(next)
  }

  private async publish(next: CachedBranding): Promise<void> {
    await this.writeCache(next)
    if (this.disposed) return
    this.current = next
    await this.pruneAssets(next)
  }

  /** 首次见到某个 revision：按声明下载全部槽位，单个槽位失败只丢该槽位。 */
  private async downloadAssets(
    document: EnterpriseBrandingDocument,
    baseUrl: URL,
  ): Promise<Partial<Record<BrandingAssetSlot, BrandingAssetRecord>>> {
    const assets: Partial<Record<BrandingAssetSlot, BrandingAssetRecord>> = {}
    for (const slot of BRANDING_ASSET_SLOTS) {
      const reference = document.logo[slot]
      if (reference === null) continue
      const record = await this.fetchAsset(slot, document.revision, reference, baseUrl)
      if (record !== undefined) assets[slot] = record
    }
    return assets
  }

  /**
   * 同 revision 下补齐缺失副本；已有副本与文档字段都不动。
   * 待补槽位取自本次远端文档的声明，因此缓存里那些「旧解析器没能读出来」的槽位也能被补上。
   */
  private async completeAssets(
    cached: CachedBranding,
    declared: EnterpriseBrandingLogoSet,
    baseUrl: URL,
  ): Promise<CachedBranding> {
    const assets = { ...cached.assets }
    for (const slot of BRANDING_ASSET_SLOTS) {
      const reference = declared[slot]
      if (reference === null || assets[slot] !== undefined) continue
      const record = await this.fetchAsset(slot, cached.revision, reference, baseUrl)
      if (record !== undefined) assets[slot] = record
    }
    return { ...cached, assets }
  }

  private async fetchAsset(
    slot: BrandingAssetSlot,
    revision: number,
    reference: string,
    baseUrl: URL,
  ): Promise<BrandingAssetRecord | undefined> {
    const downloaded = await this.download(baseUrl, reference)
    if (downloaded === undefined) return undefined
    const file = brandingAssetFileName(slot, revision, downloaded.extension)
    await this.writeAsset(file, downloaded.bytes)
    return { file, contentType: downloaded.contentType }
  }

  /** 本次远端文档声明的槽位都已经有副本，才算命中缓存。 */
  private assetsComplete(cached: CachedBranding, declared: EnterpriseBrandingLogoSet): boolean {
    return BRANDING_ASSET_SLOTS.every(slot => declared[slot] === null || cached.assets[slot] !== undefined)
  }

  private async fetchJson(baseUrl: URL): Promise<unknown> {
    const response = await this.fetchWithTimeout(new URL(BRANDING_REMOTE_PATH, baseUrl), {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`branding endpoint returned ${response.status}`)
    return await response.json()
  }

  private async download(
    baseUrl: URL,
    reference: string,
  ): Promise<{ readonly bytes: Buffer, readonly contentType: string, readonly extension: string } | undefined> {
    const url = resolveBrandingAssetUrl(reference, baseUrl)
    if (url === undefined) {
      this.fail('asset-origin', new Error('branding asset must stay on the platform origin'))
      return undefined
    }
    try {
      const response = await this.fetchWithTimeout(url, { headers: { accept: 'image/*' } })
      if (!response.ok) throw new Error(`branding asset returned ${response.status}`)
      const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0]!.trim().toLowerCase()
      const extension = BRANDING_MIME_EXTENSIONS[contentType]
      if (extension === undefined) throw new Error(`branding asset type is not allowed: ${contentType || 'unknown'}`)
      const bytes = await readCapped(response, BRANDING_MAX_ASSET_BYTES)
      if (bytes === undefined) throw new RangeError('branding asset exceeds the size limit')
      if (bytes.byteLength === 0) throw new Error('branding asset is empty')
      return { bytes, contentType, extension }
    } catch (error) {
      this.fail('asset-fetch', error)
      return undefined
    }
  }

  private async fetchWithTimeout(input: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(
      () => { controller.abort(new DOMException('branding request timed out', 'TimeoutError')) },
      this.timeoutMs,
    )
    timer.unref()
    try {
      return await this.options.fetch(input, { ...init, redirect: 'error', signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private async writeCache(next: CachedBranding): Promise<void> {
    await mkdir(dirname(this.cachePath), { mode: 0o700, recursive: true })
    const temporary = `${this.cachePath}.${process.pid}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      await rename(temporary, this.cachePath)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  }

  private async writeAsset(file: string, bytes: Buffer): Promise<void> {
    await mkdir(this.cacheDirectory, { mode: 0o700, recursive: true })
    const path = join(this.cacheDirectory, file)
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 })
      await rename(temporary, path)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  }

  /** 旧 revision 的副本没有读者，随新文档一起清掉，避免缓存目录无界增长。 */
  private async pruneAssets(current: CachedBranding): Promise<void> {
    const keep = new Set(Object.values(current.assets).map(asset => asset?.file))
    try {
      for (const name of await readdir(this.cacheDirectory)) {
        if (!keep.has(name)) await rm(join(this.cacheDirectory, name), { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.fail('asset-prune', error)
    }
  }

  private fail(operation: string, error: unknown): void {
    this.options.onFailure?.(operation, error)
  }
}
