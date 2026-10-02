/**
 * [INPUT]: 依赖核心（`./preset/index.js`：安装器三端口、授权三态与写入口、纯函数渲染）与同目录的 `preset-source.ts`（既有下载面取配方正文）
 * [OUTPUT]: 对外提供 `createEnterprisePresetService`——三条**本机路由端口** `enable(presetPackageId, confirmFingerprint?)` / `disable(declarationId)` / `status(presetPackageId)`，把核心的**结果对象**投影成三个关闭键集的**脱敏视图**（`EnterprisePresetEnableView`/`EntreprisePresetDisableView`/`EnterprisePresetStatusView`：绝不带 `bundleDir` 这类宿主绝对路径、绝不带官方自由文本 warnings），并把失败一律翻成抛出的稳定 `EnterprisePresetError`
 * [POS]: bundle 配方纵深的**宿主接线层**（核心与本地路由之间的那一段），同时也是**出 host 的脱敏闸门**。核心刻意返回结果对象而不抛（它要能被单测直接调用、也要能在批量编排里不中断），因此两件事必须由**唯一一处**这里决定：① 一次失败该带哪枚 `ENT_*` 码（`platform-client` 的 `enterpriseLocalErrorStatus` 只认稳定码，200 只回成功事实）；② 交到浏览器的那几个键集（宿主绝对路径与官方自由文本只进 Host 日志）。授权写入**只发生在**调用方交来 `confirmFingerprint` 且与当前配方指纹逐字相等时（把"员工确认过的那份披露"与该指纹绑死），否则一律按核心的三态拒；`status` 复用同一次渲染，因此 `authorization`/`disclosure` 与随后 `enable` 校验的是同一份指纹
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterprisePresetError, presetBadRequest, type EnterprisePresetErrorCode } from './preset/errors.js'
import {
  authorizePreset,
  presetBundleSetFingerprint,
  presetDisclosure,
  renderPresetBundle,
  resolvePresetAuthorization,
  type EnterprisePresetInstall,
  type InstalledPresetRecord,
  type PresetApplication,
  type PresetApplicationKind,
  type PresetAuthorizationOptions,
  type PresetAuthorizationStatus,
  type PresetDisclosure,
} from './preset/index.js'
import type { EnterprisePresetRecipeSource } from './preset-source.js'

const HEX64_PATTERN = /^[0-9a-f]{64}$/

/** 一次被拒的启用/停用该带哪枚稳定码与哪句 Host 侧说明（界面只看码，说明只进日志）。 */
const PRESET_REFUSAL_MESSAGES: Readonly<Record<EnterprisePresetErrorCode, string>> = {
  ENT_INVALID_REQUEST: 'the preset request is invalid',
  ENT_RESOURCE_NOT_FOUND: 'this preset is not installed on this machine',
  ENT_PRESET_RECIPE_INVALID: 'the preset recipe is not installable',
  ENT_PRESET_BUNDLE_WRITE_FAILED: 'the synthesized preset bundle could not be written',
  ENT_PRESET_AUTHORIZATION_REQUIRED: 'the user must confirm this preset disclosure before it can be enabled',
  ENT_PRESET_AUTHORIZATION_STALE: 'the confirmed preset fingerprint no longer matches the current recipe',
  ENT_PRESET_ARTIFACT_UNAVAILABLE: 'the published preset artifact is unavailable',
  ENT_PRESET_INSTALL_IN_PROGRESS: 'a preset install or removal is already in progress',
  ENT_PRESET_INSTALL_FAILED: 'the official bundle install failed',
  ENT_PRESET_INSTALL_CANCELLED: 'the official bundle install was cancelled',
  ENT_PRESET_UNINSTALL_FAILED: 'the official bundle removal failed',
  ENT_PRESET_STATE_INVALID: 'the local preset state is invalid',
}

/**
 * 一条已装配方给界面的**脱敏投影**。
 *
 * 比核心的 `InstalledPresetRecord` 少了 `bundleDir`——那是宿主绝对路径（`<dshHome>/enterprise/preset-bundles/…`），
 * 浏览器既不需要也不该看到；它与技能侧「已装态只回名字不回落点」是同一条纪律。
 * 卸载要用的 `declarationId` 在这里，界面不需要第二个入口去猜。
 */
export interface EnterpriseInstalledPresetView {
  readonly declarationId: string
  readonly recipeId: string
  readonly displayName: string
  readonly packageName: string
  readonly fingerprint: string
  readonly version: string
  readonly installedAt: string
  readonly officialApplication: PresetApplication
}

/** `POST <local>/presets/<id>/enable` 的 200 响应体（关闭键集；失败一律非 2xx + `error.code`）。 */
export interface EnterprisePresetEnableView {
  readonly application: PresetApplicationKind
  readonly officialApplication?: PresetApplication
  readonly installedNames: readonly string[]
  readonly needsNewSession: boolean
  readonly declarationId: string
  readonly fingerprint: string
  /** 这次真正装了什么（弹层确认过的同一份披露）。 */
  readonly disclosure: PresetDisclosure
  /** 同配方同指纹且 link 仍在：本次没有真的再装一遍。 */
  readonly alreadyInstalled?: boolean
  /** 官方失败的**受控**码（自由文本诊断只进 Host 日志）。 */
  readonly officialError?: { readonly code?: string }
}

/** `POST <local>/presets/<id>/disable` 的 200 响应体（关闭键集）。 */
export interface EnterprisePresetDisableView {
  readonly application: PresetApplicationKind
  readonly officialApplication?: PresetApplication
  readonly declarationId: string
  readonly removedNames: readonly string[]
  readonly linkRemoved: boolean
}

/**
 * `GET <local>/presets/<id>/status` 的 200 响应体（关闭键集）。
 *
 * 三枚父级要求的键（`authorization` / `inFlight` / `disclosure`）都是**披露弹层要用的真值**：
 * 它们与随后 `enable` 用的是同一次渲染结果，故员工看到的东西与真正会装的东西不可能不一致。
 */
export interface EnterprisePresetStatusView {
  /** 路由里的中心配方包雪花 id。 */
  readonly presetPackageId: string
  /** 归一化后的声明 id（= 官方 Loader row id 去掉 `preset-` 前缀；`disable` 用它）。 */
  readonly declarationId: string
  /** 当前配方正文的集合指纹（与 `disclosure.fingerprint` 同值）。 */
  readonly fingerprint: string
  /** 三态：`needs-authorization` / `authorized` / `fingerprint-changed`。 */
  readonly authorization: PresetAuthorizationStatus
  /** 该声明此刻是否有安装/卸载在进行中。 */
  readonly inFlight: boolean
  /** 这份配方会装什么（我们的最小 bundle + 配方会挂载的模块）。 */
  readonly disclosure: PresetDisclosure
  /** 本机已装记录（脱敏投影）；未装即 `null`。 */
  readonly installed: EnterpriseInstalledPresetView | null
}

/** 三条本机路由端口；`platform-client` 只做转发与状态码投影，不做任何语义判断。 */
export interface EnterprisePresetService {
  enable(presetPackageId: string, confirmFingerprint?: string): Promise<EnterprisePresetEnableView>
  disable(declarationId: string): Promise<EnterprisePresetDisableView>
  status(presetPackageId: string): Promise<EnterprisePresetStatusView>
}

export interface EnterprisePresetServiceOptions {
  /** 核心安装器（`createEnterprisePresetInstall`）。 */
  readonly install: EnterprisePresetInstall
  /** 配方正文来源（`createEnterprisePresetRecipeSource`）；两条只读口与 enable 共用它。 */
  readonly source: EnterprisePresetRecipeSource
  /** 授权状态的落点选项；**必须与安装器同一个 dshHome**（组合层两边都不传即都用默认决议）。 */
  readonly authorization?: PresetAuthorizationOptions
  /** 判定点留痕；组合层接到 Host logger。 */
  readonly onError?: (message: string, error: unknown) => void
}

/** 把核心的失败结果翻成抛出的稳定错误；没有码就按该动作的既有兜底码。 */
function refuse(code: EnterprisePresetErrorCode | undefined, fallback: EnterprisePresetErrorCode): never {
  const resolved = code ?? fallback
  throw new EnterprisePresetError(resolved, PRESET_REFUSAL_MESSAGES[resolved])
}

/** 已装记录 → 界面视图：只去掉宿主绝对路径 `bundleDir`，其余逐字保留。 */
function installedView(record: InstalledPresetRecord): EnterpriseInstalledPresetView {
  return {
    declarationId: record.declarationId,
    recipeId: record.recipeId,
    displayName: record.displayName,
    packageName: record.packageName,
    fingerprint: record.fingerprint,
    version: record.version,
    installedAt: record.installedAt,
    officialApplication: record.officialApplication,
  }
}

/**
 * 组装三条本机路由端口。
 *
 * `enable` 的授权语义（本文件的唯一一处便利判断）：调用方**没有**交 `confirmFingerprint` 时，
 * 一切交给核心的三态查询（已授权就装、未授权/指纹已变就如实拒），绝不替用户"顺手授权"；
 * 交了 `confirmFingerprint` 才写授权，且要求它与**当前**配方指纹逐字相等——避免"员工确认的是旧披露、
 * 服务端已经换了新版本"被悄然放行（指纹已变就是 `ENT_PRESET_AUTHORIZATION_STALE`）。
 *
 * 官方 `warnings`（自由文本，可能含宿主路径或 pnpm 输出）**不进响应体**，只经 `onError` 留 Host 日志；
 * 卸载后残壳有没有清干净由结构化的 `linkRemoved` 表达。
 *
 * @param options - 核心安装器、配方正文来源、授权落点与留痕端口。
 * @returns 三条本机路由端口（失败一律抛出稳定 `EnterprisePresetError`）。
 */
export function createEnterprisePresetService(options: EnterprisePresetServiceOptions): EnterprisePresetService {
  const authorization = options.authorization ?? {}
  const report = options.onError

  async function enable(
    presetPackageId: string,
    confirmFingerprint?: string,
  ): Promise<EnterprisePresetEnableView> {
    if (confirmFingerprint !== undefined && !HEX64_PATTERN.test(confirmFingerprint)) {
      throw presetBadRequest('confirmFingerprint must be a lowercase hex sha256 fingerprint')
    }
    const recipe = await options.source.recipe(presetPackageId)
    const rendered = renderPresetBundle(recipe)
    const fingerprint = presetBundleSetFingerprint(rendered.bundleSet)
    if (confirmFingerprint !== undefined) {
      if (confirmFingerprint !== fingerprint) {
        report?.('preset disclosure fingerprint changed before it was confirmed', undefined)
        refuse('ENT_PRESET_AUTHORIZATION_STALE', 'ENT_PRESET_AUTHORIZATION_STALE')
      }
      await authorizePreset(authorization, rendered.declarationId, fingerprint)
    }
    const result = await options.install.enable(recipe)
    if (!result.ok) refuse(result.errorCode, 'ENT_PRESET_INSTALL_FAILED')
    if (result.warnings !== undefined) {
      report?.('official preset install reported warnings', result.warnings.join('; '))
    }
    return {
      application: result.application,
      installedNames: result.installedNames,
      needsNewSession: result.needsNewSession,
      declarationId: result.declarationId ?? rendered.declarationId,
      fingerprint: result.fingerprint ?? fingerprint,
      disclosure: result.disclosure ?? presetDisclosure(rendered.bundleSet),
      ...(result.officialApplication === undefined ? {} : { officialApplication: result.officialApplication }),
      ...(result.alreadyInstalled === undefined ? {} : { alreadyInstalled: result.alreadyInstalled }),
      ...(result.officialError === undefined ? {} : { officialError: result.officialError }),
    }
  }

  async function disable(declarationId: string): Promise<EnterprisePresetDisableView> {
    const result = await options.install.disable(declarationId)
    if (!result.ok) refuse(result.errorCode, 'ENT_PRESET_UNINSTALL_FAILED')
    if (result.warnings !== undefined) {
      report?.('official preset removal reported warnings', result.warnings.join('; '))
    }
    return {
      application: result.application,
      declarationId: result.declarationId,
      removedNames: result.removedNames,
      linkRemoved: result.linkRemoved,
      ...(result.officialApplication === undefined ? {} : { officialApplication: result.officialApplication }),
    }
  }

  async function status(presetPackageId: string): Promise<EnterprisePresetStatusView> {
    const recipe = await options.source.recipe(presetPackageId)
    const rendered = renderPresetBundle(recipe)
    const fingerprint = presetBundleSetFingerprint(rendered.bundleSet)
    const [authorizationState, installed] = await Promise.all([
      resolvePresetAuthorization(authorization, rendered.declarationId, fingerprint),
      options.install.status(),
    ])
    const record = installed.installs.find(item => item.declarationId === rendered.declarationId)
    return {
      presetPackageId,
      declarationId: rendered.declarationId,
      fingerprint,
      authorization: authorizationState,
      inFlight: options.install.busy(rendered.declarationId),
      disclosure: presetDisclosure(rendered.bundleSet),
      installed: record === undefined ? null : installedView(record),
    }
  }

  return { enable, disable, status }
}
