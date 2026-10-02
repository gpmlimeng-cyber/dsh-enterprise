/**
 * [INPUT]: 依赖 platform-client 的 `resolveEnterpriseDshHome`、plugin-distribution 的共用下载内核 `downloadVerifiedArtifact`（size + SHA-256 强制校验 + `.part` 原子改名 + sha256 内容寻址缓存）、同目录的 `decodeDshPresetArchive`，以及核心的 `PresetRecipe`/稳定码
 * [OUTPUT]: 对外提供 `createEnterprisePresetRecipeSource`（`recipe(presetPackageId)` → 核心可直接安装的 `PresetRecipe`）、契约路径常量 `ENTERPRISE_PRESET_LIST_PATH` 与 `ENTERPRISE_PRESET_DOWNLOAD_PATH`
 * [POS]: bundle 配方纵深的**配方正文来源**——一键启用必须拿到配方包里的 `preset/agent.cordis.yml`，而中心唯一能给出它的是**既有**的运行时下载 operation（见下面的证据注释）；本文件**不新造第二个下载通道**：详情取权威 `versionId/sha256/sizeBytes` 走既有的 `EnterprisePlatformService.getPreset`（与 platform-client `/presets/<id>` 本机路由同一份取数面），字节走既有的 `downloadVerifiedArtifact`（与技能安装同一个内核）。制品落 `<dshHome>/enterprise/preset-artifacts/<sha256>.dshpreset`，同 sha256 命中缓存即**零网络**（因此 `GET .../status` 反复调用不会重复下载）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { downloadVerifiedArtifact } from '@dshent/plugin-distribution'
import { EnterprisePresetError, presetBadRequest } from './preset/errors.js'
import type { PresetRecipe } from './preset/bundle.js'
import { decodeDshPresetArchive, PRESET_ARCHIVE_MAX_BYTES, type EnterprisePresetArchive } from './preset-archive.js'

/**
 * 中心运行时配方列表/详情前缀（契约真源：`contracts/enterprise-openapi.yaml:148-151`，
 * `listRuntimePresets`/`getRuntimePreset`）。与 `bundle/src/skill-route.ts:12` 的技能前缀同族。
 */
export const ENTERPRISE_PRESET_LIST_PATH = '/enterprise/api/v1/presets'

/**
 * 中心运行时配方**授权下载** operation 的路径模板（契约真源：
 * `contracts/enterprise-openapi.yaml:152` → `contracts/paths/preset.yaml:189-221`，
 * `operationId: downloadRuntimePreset`，带 `Range` 头、200/206、`application/vnd.dsh.preset+zip`）。
 *
 * 这就是员工端那条既有下载面；UI 现在自己拼同一个 URL 交给 Agent
 * （`plugin/packages/ui/src/preset-market.tsx:56-61` 的 `buildPresetImportInstruction`）。
 * Host 侧不新开口子，只是**用同一条 operation 代取令牌下载**。
 */
export const ENTERPRISE_PRESET_DOWNLOAD_PATH = `${ENTERPRISE_PRESET_LIST_PATH}/versions`

/** 下载路径：`<前缀>/<versionId>/download`。 */
export function presetArtifactDownloadPath(versionId: string): string {
  return `${ENTERPRISE_PRESET_DOWNLOAD_PATH}/${versionId}/download`
}

/** 制品落点（与技能制品的 `enterprise/skill-artifacts` 同级）。 */
const PRESET_ARTIFACT_DIR_SEGMENTS = ['enterprise', 'preset-artifacts'] as const

const PRESET_ID_PATTERN = /^[1-9][0-9]{0,18}$/
const PRESET_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
/** 上游稳定码形状：只有它认识的 `ENT_*` 才允许穿透到响应体（与 `skill-install.ts:31` 同把尺）。 */
const ERROR_CODE_PATTERN = /^ENT_[A-Z0-9_]{2,61}$/

/** 代取令牌所需的最小平台面；`EnterprisePlatformService` 结构性满足它。 */
export interface EnterprisePresetSourcePlatformPort {
  /** 中心运行时配方详情；返回的正文与 `contracts/fixtures/runtime-preset-detail-success.json` 同形。 */
  getPreset(presetPackageId: string, signal?: AbortSignal): Promise<unknown>
  /** 带令牌的同源平台请求面（`downloadVerifiedArtifact` 唯一需要的形状）。 */
  request(input: string, init?: RequestInit): Promise<Response>
}

export interface EnterprisePresetRecipeSourceOptions {
  readonly platform: EnterprisePresetSourcePlatformPort
  /** 宿主 Harness home；缺省用 `resolveEnterpriseDshHome()`（显式 → `$DSH_HOME` → `~/.dsh`）。 */
  readonly dshHome?: string
  /** 判定点留痕；组合层接到 Host logger。 */
  readonly onError?: (message: string, error: unknown) => void
}

/** 配方正文来源：给定中心配方包雪花 id，交回核心可直接安装的配方。 */
export interface EnterprisePresetRecipeSource {
  recipe(presetPackageId: string): Promise<PresetRecipe>
  /** 同上，但另外交回包内 `manifest.json` 的 `presetId` 与正文路径（状态诊断用）。 */
  archive(presetPackageId: string): Promise<EnterprisePresetArchive>
}

/** 中心详情里安装真正需要的几个事实；展示字段（displayName/description）不进落盘路径。 */
interface PresetDetailFacts {
  readonly presetId: string
  readonly versionId: string
  readonly sha256: string
  readonly sizeBytes: number
}

/** 读 `error.code`：只认受控 `ENT_*` 形状，Node 的 `ENOENT`/`Z_DATA_ERROR` 等内码不得穿透。 */
function upstreamCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && ERROR_CODE_PATTERN.test(code) ? code : undefined
}

/** 详情投影：**必须**是同一个包（`id` 逐字相等）、版本坐标与校验坐标齐全。 */
function readPresetDetail(value: unknown, packageId: string): PresetDetailFacts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'preset detail is not an object')
  }
  const row = value as Record<string, unknown>
  const presetId = row['presetId']
  const versionId = row['versionId']
  const sha256 = row['sha256']
  const sizeBytes = row['sizeBytes']
  if (row['id'] !== packageId
    || typeof presetId !== 'string' || presetId.length > 128 || !PRESET_REF_PATTERN.test(presetId)
    || typeof versionId !== 'string' || !PRESET_ID_PATTERN.test(versionId)
    || typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)
    || typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes)
    || sizeBytes <= 0 || sizeBytes > PRESET_ARCHIVE_MAX_BYTES) {
    throw new EnterprisePresetError('ENT_PRESET_RECIPE_INVALID', 'preset detail is not installable')
  }
  return { presetId, versionId, sha256, sizeBytes }
}

/**
 * 组装配方正文来源。
 *
 * 上游失败**原样穿透**：平台 Service 已把非 2xx 折叠成带受控 `code` 的 `EnterprisePlatformError`
 * （401 会话过期、403 不可见/已退休），本地路由的投影表据此给出正确状态码；包成新失败反而丢掉可操作原因。
 * 制品本身对不上（大小/hash/包内身份与详情不符）归到 `ENT_PRESET_ARTIFACT_UNAVAILABLE`（503 族），
 * 因为那是"这次没拿到可用的配方制品"，不是"请求非法"。
 *
 * @param options - 平台取数面、可选 dshHome 与留痕端口。
 * @returns 配方正文来源端口。
 */
export function createEnterprisePresetRecipeSource(
  options: EnterprisePresetRecipeSourceOptions,
): EnterprisePresetRecipeSource {
  const dshHome = resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome })
  const artifactDirectory = join(dshHome, ...PRESET_ARTIFACT_DIR_SEGMENTS)
  const report = options.onError

  async function archive(presetPackageId: string): Promise<EnterprisePresetArchive> {
    if (typeof presetPackageId !== 'string' || !PRESET_ID_PATTERN.test(presetPackageId)) {
      throw presetBadRequest('preset packageId must be a snowflake id')
    }
    const detail = readPresetDetail(await options.platform.getPreset(presetPackageId), presetPackageId)
    const artifactPath = await downloadVerifiedArtifact({
      platform: options.platform,
      // 既有下载面：同一条运行时授权下载 operation（含 Range/ETag 的服务端实现），不新造通道。
      downloadUrl: presetArtifactDownloadPath(detail.versionId),
      sizeBytes: detail.sizeBytes,
      sha256: detail.sha256,
      directory: artifactDirectory,
      extension: '.dshpreset',
      accept: 'application/vnd.dsh.preset+zip',
      failure: (kind, message, cause) => {
        const upstream = upstreamCode(cause)
        if (cause instanceof Error && upstream !== undefined) return cause
        const reason = kind === 'size' ? 'preset artifact size does not match the published detail'
          : kind === 'hash' ? 'preset artifact hash does not match the published detail'
            : 'preset artifact download failed'
        return cause === undefined
          ? new EnterprisePresetError('ENT_PRESET_ARTIFACT_UNAVAILABLE', reason)
          : new EnterprisePresetError('ENT_PRESET_ARTIFACT_UNAVAILABLE', reason, { cause })
      },
    })
    const bytes = await readFile(artifactPath)
    if (bytes.byteLength !== detail.sizeBytes) {
      throw new EnterprisePresetError('ENT_PRESET_ARTIFACT_UNAVAILABLE', 'downloaded preset artifact changed size')
    }
    const decoded = decodeDshPresetArchive(bytes)
    if (decoded.presetId !== detail.presetId) {
      const mismatch = new EnterprisePresetError(
        'ENT_PRESET_ARTIFACT_UNAVAILABLE',
        'preset artifact does not match the published preset id',
      )
      report?.('preset artifact does not match the published preset id', mismatch)
      throw mismatch
    }
    return decoded
  }

  return {
    archive,
    async recipe(presetPackageId: string): Promise<PresetRecipe> {
      return (await archive(presetPackageId)).recipe
    },
  }
}
