/**
 * [INPUT]: 只依赖本目录下的模块（`./errors.js` / `./capability.js` / `./policy.js` / `./bundle.js`），**不 import `../../index.js`**、不 import 任何 `@deepseek-ai/*` 的运行时值
 * [OUTPUT]: 把连接器纵深的 Host 侧纯内核与安装编排收在一处：稳定错误码、能力声明的字段模型与注册表、L1/L2/L3 求值与决策函数、配置型 bundle 的渲染与落盘合成、以及「合成好的 bundle → 官方唯一安装面」的端口化编排与本机已装清单
 * [POS]: bundle 连接器纵深的**本地出口**（与 `src/library/index.ts`、`src/preset/index.ts` 同一条纪律——只交「可被单测直接 import 的纯模块 + 可注入的官方安装端口」）。**宿主接线尚未落地**：路由、企业目录、迁移号都还没做（P0-3/P0-4/P0-6 与市场面 C0–C5 各自另开刀），故本目录今天没有任何模块被 `../index.ts` import；安装段虽已就绪，但没有任何路由或界面调用它 ⇒ 运行时行为与上一刀完全相同
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// 稳定错误码与错误类型
export {
  EnterpriseConnectorError,
  connectorBadRequest,
  connectorError,
  type EnterpriseConnectorErrorCode,
} from './errors.js'

// P0-1 模型与注册表：能力声明 → 可校验、可指纹、可查表
export {
  CONNECTOR_BLAST_RADII,
  CONNECTOR_DISCOVERIES,
  CONNECTOR_EFFECTS,
  CONNECTOR_HOST_PLATFORMS,
  CONNECTOR_INBOUNDS,
  CONNECTOR_PLATFORM_SUPPORTS,
  CONNECTOR_REQUIRED_DECLARATION_FIELDS,
  CONNECTOR_REVERSIBILITIES,
  CONNECTOR_STATE_ADDRESS_KINDS,
  CONNECTOR_TRANSPORTS,
  connectorCapabilityFingerprint,
  connectorInboundKind,
  createConnectorCapabilityRegistry,
  readConnectorCapabilityDeclaration,
  type ConnectorBlastRadius,
  type ConnectorCapabilityDeclaration,
  type ConnectorCapabilityRegistry,
  type ConnectorDiscovery,
  type ConnectorEffect,
  type ConnectorHostPlatform,
  type ConnectorInbound,
  type ConnectorPlatformRequirement,
  type ConnectorPlatformSupport,
  type ConnectorQuota,
  type ConnectorReversibility,
  type ConnectorStateAddress,
  type ConnectorStateAddressKind,
  type ConnectorTransport,
} from './capability.js'

// P0-1 策略求值器：两轴算层级 + 决策函数（不产出员工可见文案）
export {
  CONNECTOR_PERMISSION_LEVELS,
  connectorCapabilityAvailability,
  connectorDecide,
  connectorEffectiveLevel,
  connectorPermissionLevel,
  connectorPlatformSupport,
  connectorStrictestLevel,
  readConnectorConsent,
  readConnectorPolicy,
  type ConnectorCapabilityAvailability,
  type ConnectorConsent,
  type ConnectorConsentReason,
  type ConnectorDecision,
  type ConnectorDecisionFacts,
  type ConnectorDenyReason,
  type ConnectorPermissionLevel,
  type ConnectorPolicy,
} from './policy.js'

// P0-2 合成段：连接器 → 官方配置型 bundle（纯函数 + 落盘）
export {
  CONNECTOR_BUNDLE_FILENAMES,
  CONNECTOR_BUNDLE_ROOT_SEGMENTS,
  CONNECTOR_ID_PATTERN,
  MAX_CONNECTOR_ID_LENGTH,
  MCP_CLIENT_MODULE,
  MCP_SERVER_NAME_PATTERN,
  MCP_TRANSPORTS,
  connectorBundleDigest,
  connectorBundlePackageName,
  connectorBundleRoot,
  connectorRowId,
  connectorServerNameFromId,
  connectorToolNamePrefix,
  renderConnectorBundle,
  synthesizeConnectorBundle,
  type McpConnectorDescriptor,
  type McpCredentialReference,
  type McpHttpEndpoint,
  type McpStdioEndpoint,
  type McpTransport,
  type RenderedConnectorBundle,
  type SynthesizeConnectorBundleOptions,
  type SynthesizedConnectorBundle,
} from './bundle.js'

// P0-2 安装段：合成好的 bundle → 官方唯一安装面（端口化 + 本机已装清单 + link 残壳清理）
export {
  CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
  cleanConnectorBundleLink,
  connectorLinkExists,
  connectorLinkPath,
  connectorPluginManagerFromContext,
  connectorProfileDirFromContext,
  createEnterpriseConnectorInstall,
  officialConnectorInstallPort,
  officialConnectorInstallPortFromContext,
  readInstalledConnectors,
  writeInstalledConnectors,
  type ConnectorApplication,
  type ConnectorApplicationKind,
  type ConnectorBundleApplication,
  type ConnectorInstallPort,
  type ConnectorInstallResult,
  type ConnectorInstallStateOptions,
  type ConnectorLinkCleanupOptions,
  type ConnectorLinkCleanupReason,
  type ConnectorLinkCleanupResult,
  type ConnectorToolAvailability,
  type ConnectorUninstallResult,
  type EnterpriseConnectorInstall,
  type EnterpriseConnectorInstallOptions,
  type EnterpriseConnectorInstallStatus,
  type InstalledConnectorRecord,
} from './install.js'

// P0-3 凭据段：官方凭据只读面 + 「配了 ≠ 送得到」的送达判定（值永不过界）
export {
  CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES,
  CONNECTOR_STORE_CREDENTIAL_SOURCE,
  connectorCredentialDeliverability,
  connectorCredentialGate,
  connectorCredentialsFromContext,
  connectorEndpointCredentialRefs,
  isOfficialCredentials,
  observeConnectorCredential,
  officialConnectorCredentialPort,
  officialConnectorCredentialPortFromContext,
  readConnectorCredentialRef,
  requireConnectorCredentials,
  type ConnectorCredentialAction,
  type ConnectorCredentialDeliverability,
  type ConnectorCredentialDescription,
  type ConnectorCredentialGateResult,
  type ConnectorCredentialObservation,
  type ConnectorCredentialPort,
  type OfficialCredentialsLike,
} from './credentials.js'
