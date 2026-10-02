/**
 * [INPUT]: 依赖 Node Web Response 流、crypto/fs、安装层验签开关与可选公钥、semver 和中心 RuntimePluginAssignment
 * [OUTPUT]: 对外提供**与制品类型无关的下载内核** `downloadVerifiedArtifact`（权威 size+sha256、`.part` 临时件、内容寻址原子改名、失败清理、可复用本地缓存、调用方自定失败码与 revalidate 钩子）与插件专用包装 `downloadAndVerifyArtifact`，以及强制大小/hash/兼容性校验、默认关闭的 Ed25519 验签与冻结 JCS 声明；兼容判定前将 android 归一化为 linux（仅判定侧，不改写签名 manifest）
 * [POS]: plugin-distribution 的制品校验边界；下载与缓存共用同一验签策略，通过后才进入安装流程。企业技能包（`.dshskill`）的下载也复用这个内核而不是另写一份落盘逻辑，因此「先 `.part`、边写边算 hash、大小/hash 不符绝不出最终文件」这条纪律只有一处实现；平台归一化使其在 Android（Linux 同源）运行时能匹配标 linux 的制品白名单
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { satisfies } from 'semver'
import { distributionError, PluginDistributionError } from './errors.js'
import type { EnterprisePlatformPort, RuntimePluginAssignment } from './types.js'

export interface ArtifactCompatibilityContext {
  readonly harnessCommit?: string
  readonly bundleVersion: string
  readonly operatingSystem?: NodeJS.Platform
}

export interface DownloadArtifactOptions extends ArtifactCompatibilityContext {
  readonly platform: EnterprisePlatformPort
  readonly assignment: RuntimePluginAssignment
  readonly dshHome: string
  readonly verifyPluginSignatures?: boolean
  readonly trustedPublicKey?: KeyObject
  readonly signal?: AbortSignal
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** 受限于签名 schema 的 RFC 8785 JSON；对象键递归排序，数值只允许安全有限整数。 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('canonical signed numbers must be safe integers')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareUtf16(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeJson(item)}`)
      .join(',')}}`
  }
  throw new TypeError('canonical JSON contains an unsupported value')
}

export function signatureManifest(assignment: RuntimePluginAssignment): Record<string, unknown> {
  return {
    artifactId: assignment.pluginVersionId,
    packageName: assignment.packageName,
    version: assignment.version,
    sizeBytes: assignment.sizeBytes,
    sha256: assignment.sha256,
    compatibility: assignment.compatibility,
  }
}

/** 安装包信任根只接受 Ed25519 SPKI PEM 或其单行 DER Base64。 */
export function parseTrustedPluginPublicKey(value: string): KeyObject {
  try {
    const key = value.includes('-----BEGIN PUBLIC KEY-----')
      ? createPublicKey(value)
      : createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' })
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('not Ed25519')
    return key
  } catch (error) {
    throw new PluginDistributionError(
      'ENT_PLUGIN_SIGNATURE_INVALID',
      'trusted plugin public key must be Ed25519 SPKI',
      { cause: error },
    )
  }
}

/**
 * 归一化受检平台到制品白名单的三平台集合（darwin/linux/win32）。
 *
 * Android 内核即 Linux，其用户态与 linux 同源；制品白名单标 `linux` 时，
 * 本机 `process.platform === 'android'` 应被视作 linux 而非第三种未知平台。
 * 仅用于兼容性判定侧，不改写 `signatureManifest` 里的 compatibility 字节
 * （签名与 RFC 8785 向量保持逐字不变）。
 */
function normalizeOperatingSystem(platform: NodeJS.Platform): 'darwin' | 'linux' | 'win32' {
  if (platform === 'android') return 'linux'
  return platform as 'darwin' | 'linux' | 'win32'
}

export function verifyAssignmentMetadata(
  assignment: RuntimePluginAssignment,
  trustedPublicKey: KeyObject | undefined,
  context: ArtifactCompatibilityContext,
  verifyPluginSignatures = false,
): void {
  const compatibility = assignment.compatibility
  const operatingSystem = context.operatingSystem ?? process.platform
  if (context.harnessCommit === undefined
    || !compatibility.harnessCommits.includes(context.harnessCommit)
    || !compatibility.operatingSystems.includes(normalizeOperatingSystem(operatingSystem))
    || !satisfies(context.bundleVersion, compatibility.enterpriseBundleRange, { includePrerelease: true })) {
    throw new PluginDistributionError('ENT_PLUGIN_INCOMPATIBLE', 'plugin assignment is incompatible with this runtime')
  }
  if (!verifyPluginSignatures) return
  if (trustedPublicKey === undefined) {
    throw new PluginDistributionError('ENT_PLUGIN_SIGNATURE_INVALID', 'managed plugin trust root is not configured')
  }
  const signature = Buffer.from(assignment.signatureBase64, 'base64')
  const canonical = Buffer.from(canonicalizeJson(signatureManifest(assignment)), 'utf8')
  if (signature.length !== 64 || !verify(null, canonical, trustedPublicKey, signature)) {
    throw new PluginDistributionError('ENT_PLUGIN_SIGNATURE_INVALID', 'plugin assignment signature is invalid')
  }
}

async function hashFile(path: string): Promise<{ readonly bytes: number; readonly sha256: string }> {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += data.byteLength
    hash.update(data)
  }
  return { bytes, sha256: hash.digest('hex') }
}

async function existingArtifact(path: string, sizeBytes: number, sha256: string): Promise<boolean> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size !== sizeBytes) return false
    const digest = await hashFile(path)
    return digest.bytes === sizeBytes && digest.sha256 === sha256
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** 下载失败的三类判定点；调用方用自己的稳定 code 体系把它们变成错误。 */
export type VerifiedDownloadFailureKind = 'download' | 'size' | 'hash'

/**
 * 一次「下载 + 强制大小/SHA-256 校验 + 原子落盘」的输入。
 *
 * 这是受管插件与企业技能共用的**唯一**下载内核：接受什么 MIME、落到哪个目录、
 * 失败码叫什么由调用方给定，而「先写 `.part` → 边写边算 hash → 校验通过才改名」
 * 与「已有内容寻址文件且完全匹配时零网络复用」这两条纪律只在这里实现一次。
 */
export interface DownloadVerifiedArtifactOptions {
  /** 代取令牌的平台请求面（浏览器永不可见凭据）。 */
  readonly platform: Pick<EnterprisePlatformPort, 'request'>
  /** 制品地址；null 表示调用方手上没有可下载地址（在命中本地缓存之后才判定）。 */
  readonly downloadUrl: string | null
  /** 权威字节数：content-length 与实收字节都必须与它逐字相等。 */
  readonly sizeBytes: number
  /** 权威小写十六进制 SHA-256：实收字节必须与它逐字相等。 */
  readonly sha256: string
  /** 目标目录，以 0700 递归创建；最终文件名是 `${sha256}${extension}`（内容寻址）。 */
  readonly directory: string
  /** 含点号的扩展名，例如 `.tgz` / `.dshskill`。 */
  readonly extension: string
  /** 请求制品时携带的 `accept`。 */
  readonly accept: string
  readonly signal?: AbortSignal
  /**
   * 校验通过后的再次确认钩子，在**命中缓存**与**校验通过即将改名**两处各调一次。
   * 受管插件用它复查 Ed25519 签名与兼容性；技能不签名故不传。
   */
  readonly revalidate?: () => void
  /** 把三类失败翻成调用方自己的稳定错误（`cause` 保留原始异常）。 */
  readonly failure: (kind: VerifiedDownloadFailureKind, message: string, cause?: unknown) => Error
}

/**
 * 下载到固定 `.part`，强制校验大小与 SHA-256，通过后原子改名为内容寻址文件。
 *
 * 失败永远清理 `.part`，因此这个过程不会留下半个制品；命中缓存时不发任何网络请求。
 *
 * @param options - 平台请求面、权威大小/hash、目标目录与失败码映射。
 * @returns 最终制品路径。
 */
export async function downloadVerifiedArtifact(options: DownloadVerifiedArtifactOptions): Promise<string> {
  const { sizeBytes, sha256 } = options
  const finalPath = join(options.directory, `${sha256}${options.extension}`)
  const partPath = `${finalPath}.part`
  await mkdir(options.directory, { recursive: true, mode: 0o700 })
  if (await existingArtifact(finalPath, sizeBytes, sha256)) {
    options.revalidate?.()
    return finalPath
  }
  await rm(finalPath, { force: true })
  await rm(partPath, { force: true })
  if (options.downloadUrl === null) {
    throw options.failure('download', 'artifact has no download URL')
  }

  let file: Awaited<ReturnType<typeof open>> | undefined
  try {
    const response = await options.platform.request(options.downloadUrl, {
      headers: { accept: options.accept },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!response.ok || response.body === null) {
      throw options.failure('download', 'artifact download did not return a body')
    }
    const contentLength = response.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) !== sizeBytes) {
      throw options.failure('size', 'artifact content length does not match the assignment')
    }
    file = await open(partPath, 'wx', 0o600)
    const reader = response.body.getReader()
    const hash = createHash('sha256')
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > sizeBytes) {
          throw options.failure('size', 'artifact download exceeded the assigned size')
        }
        hash.update(chunk.value)
        await file.write(chunk.value)
      }
    } finally {
      reader.releaseLock()
    }
    await file.sync()
    await file.close()
    file = undefined
    if (bytes !== sizeBytes) {
      throw options.failure('size', 'artifact download size does not match the assignment')
    }
    if (hash.digest('hex') !== sha256) {
      throw options.failure('hash', 'artifact download hash does not match the assignment')
    }
    options.revalidate?.()
    await rename(partPath, finalPath)
    return finalPath
  } catch (error) {
    throw options.failure('download', 'artifact download failed', error)
  } finally {
    await file?.close().catch(() => undefined)
    await rm(partPath, { force: true })
  }
}

/** 下载到固定 `.part`，校验全部信任事实后原子改名为 hash CAS 文件。 */
export async function downloadAndVerifyArtifact(options: DownloadArtifactOptions): Promise<string> {
  const { assignment } = options
  return downloadVerifiedArtifact({
    platform: options.platform,
    downloadUrl: assignment.downloadUrl,
    sizeBytes: assignment.sizeBytes,
    sha256: assignment.sha256,
    directory: join(options.dshHome, 'enterprise', 'artifacts'),
    extension: '.tgz',
    accept: 'application/octet-stream',
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    revalidate: () => {
      verifyAssignmentMetadata(assignment, options.trustedPublicKey, options, options.verifyPluginSignatures)
    },
    failure: (kind, message, cause) => {
      const code = kind === 'size' ? 'ENT_PLUGIN_SIZE_MISMATCH'
        : kind === 'hash' ? 'ENT_PLUGIN_HASH_MISMATCH'
          : 'ENT_PLUGIN_DOWNLOAD_FAILED'
      return cause === undefined
        ? new PluginDistributionError(code, message)
        : distributionError(cause, code, message)
    },
  })
}
