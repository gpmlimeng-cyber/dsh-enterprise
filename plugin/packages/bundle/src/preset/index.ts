/**
 * [INPUT]: 只依赖本目录下的模块（`./errors.js` / `./bundle.js` / `./authorization.js` / `./install.js`）与 platform-client 的既有入口，**不 import 任何 `@deepseek-ai/*` 的运行时值**、不 import `../../index.js`。唯一例外是 `./wiring.js` 里 `import type { Inject } from '@deepseek-ai/cordis'`——**纯类型**（`verbatimModuleSyntax` 下被擦除、不进产物），换来的正是本缺陷的解药：按官方 inject 语义声明依赖
 * [OUTPUT]: 把「配方一键启用」Host 侧核心的公开面收在一处：稳定错误码、合成（纯函数 + 落盘）、授权门（指纹/三态/披露）、**官方 inject 声明的延迟接线（`./wiring.js`）**、安装端口与安装器、卸载与 link 残壳清理、统一结果对象
 * [POS]: bundle 配方纵深的**本地出口**。与 `src/library/index.ts` 同一条纪律——本目录只交「可被单测直接 import 的纯模块 + 可注入的官方安装端口 + 可注入假 ctx 的延迟接线」。**宿主接线的落地仍在 `../index.ts`**（用 `deferEnterprisePresetWiring(ctx, …)` 等官方 `pluginManager` 服务就绪后拿安装面 + `../preset-source.ts` 的既有下载面取配方正文 + `../preset-service.ts` 的三端口），`cordis.patch.yml` 的手写内容、`ui/`、`contracts/`、`server/`、`console/` 与 web profile 一律不动
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// 稳定错误码与错误类型
export {
  EnterprisePresetError,
  presetBadRequest,
  presetError,
  type EnterprisePresetErrorCode,
} from './errors.js'

// 合成段：配方 → 最小 bundle（纯函数 + 落盘）
export {
  AGENT_PRESET_MODULE,
  FACTORY_PRESET_IDS,
  PRESET_BUNDLE_FILENAMES,
  PRESET_BUNDLE_ROOT_SEGMENTS,
  bundleDigest,
  extractPresetMounts,
  normalizePresetId,
  presetBundlePackageName,
  presetBundleRoot,
  presetBundleSet,
  presetRowId,
  renderPresetBundle,
  synthesizePresetBundle,
  type PresetBundleSetItem,
  type PresetMount,
  type PresetRecipe,
  type PresetRecipeManifest,
  type RenderedPresetBundle,
  type SynthesizePresetBundleOptions,
  type SynthesizedPresetBundle,
} from './bundle.js'

// 授权门：集合指纹、三态、披露数据
export {
  authorizePreset,
  presetAuthorizationPath,
  presetBundleSetFingerprint,
  presetDisclosure,
  readPresetAuthorizations,
  resolvePresetAuthorization,
  revokePresetAuthorization,
  type PresetAuthorizationOptions,
  type PresetAuthorizationRecord,
  type PresetAuthorizationState,
  type PresetAuthorizationStatus,
  type PresetDisclosure,
} from './authorization.js'

// 时序边界段：官方 inject 声明 + 延迟解析（服务就绪后才把端口交给路由）
export {
  PRESET_WIRING_SERVICES,
  createLateBoundPresetService,
  deferEnterprisePresetWiring,
  unavailablePresetInstallPort,
  type EnterprisePresetWiringContext,
  type EnterprisePresetWiringLog,
  type EnterprisePresetWiringOptions,
  type LateBoundPresetService,
  type LateBoundPresetServiceOptions,
} from './wiring.js'

// 安装段：端口、官方默认实现、安装器、卸载与残壳清理
export {
  cleanPresetBundleLink,
  createEnterprisePresetInstall,
  officialPresetInstallPort,
  officialPresetInstallPortFromContext,
  presetLinkExists,
  presetLinkPath,
  presetPluginManagerFromContext,
  presetProfileDirFromContext,
  readInstalledPresets,
  readPresetBundleDirectory,
  writeInstalledPresets,
  type EnterprisePresetDisableResult,
  type EnterprisePresetEnableResult,
  type EnterprisePresetInstall,
  type EnterprisePresetInstallOptions,
  type EnterprisePresetInstallStatus,
  type InstalledPresetRecord,
  type OfficialPluginManagerLike,
  type PresetApplication,
  type PresetApplicationKind,
  type PresetBundleApplication,
  type PresetInstallPort,
  type PresetInstallStateOptions,
  type PresetLinkCleanupOptions,
  type PresetLinkCleanupReason,
  type PresetLinkCleanupResult,
} from './install.js'
