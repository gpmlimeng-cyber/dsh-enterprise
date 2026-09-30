/**
 * [INPUT]: 依赖调用方给出的同源本地 API 端口（`openHelp`）、浏览器 `window.open` 兜底，以及账号投影里的平台地址
 * [OUTPUT]: 对外提供「帮助与文档」行文案常量 ENTERPRISE_HELP_LABEL/ENTERPRISE_HELP_HINT/ENTERPRISE_HELP_UNCONFIGURED_HINT、地址派生 enterpriseHelpUrl、提示投影 enterpriseHelpHint 与打开动作 openEnterpriseHelp（Host 系统浏览器优先、window.open 兜底）
 * [POS]: dsh-ui 的「帮助与文档」入口语义层：地址永远由平台地址派生（不写死域名），打开优先走 Host 侧系统浏览器通道（PKCE 登录用的同一条能力，经 bundle 的同源路由），该路由缺席时退 `window.open(url, '_blank', 'noopener')`；本文件不渲染任何界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 行标签恒为「帮助与文档」；右侧状态与动作都不重复它。 */
export const ENTERPRISE_HELP_LABEL = '帮助与文档'

/** 该站点与 API 文档共用会话门禁：文案必须写明「需登录」，不让用户在登录页前愣住。 */
export const ENTERPRISE_HELP_HINT = '将打开帮助中心（需登录）'

/** 平台地址未配置时的可见提示：行禁用，但把原因摆在行上，绝不静默。 */
export const ENTERPRISE_HELP_UNCONFIGURED_HINT = '请先配置企业 Server 地址'

/** 两条打开路径都失败时的可见提示前缀（后面接派生的地址，让用户能手动走过去）。 */
export const ENTERPRISE_HELP_FAILED_HINT = '未能打开帮助中心，请手动在浏览器中访问 '

/** 帮助站在后台 nginx 上的固定路径；与 API 文档同源、共用会话门禁。 */
export const ENTERPRISE_HELP_PATH = '/help/'

/**
 * 平台地址 → 帮助站地址。只接受可解析的 http(s) origin；未配置、非 http(s) 或畸形一律 undefined
 * （调用方据此禁用该行），**绝不**回落到任何硬编码域名。
 */
export function enterpriseHelpUrl(platformUrl: string | null | undefined): string | undefined {
  if (platformUrl === null || platformUrl === undefined || platformUrl === '') return undefined
  let parsed: URL
  try {
    parsed = new URL(platformUrl)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined
  return new URL(ENTERPRISE_HELP_PATH, parsed.origin).toString()
}

/** 行右侧的弱化提示：未配置说清要先配置，配置好了说清需要登录。 */
export function enterpriseHelpHint(isPlatformConfigured: boolean): string {
  return isPlatformConfigured ? ENTERPRISE_HELP_HINT : ENTERPRISE_HELP_UNCONFIGURED_HINT
}

/** 打开动作需要的最小 API 面；`EnterpriseAccountStore.api` 结构性满足它。 */
export interface EnterpriseHelpApiPort {
  openHelp(signal: AbortSignal): Promise<void>
}

/** 打开结果：走了 Host 通道、退了浏览器兜底，或两条路都没成（此时界面必须给出可见反馈）。 */
export type EnterpriseHelpOutcome = 'host' | 'window' | 'failed'

export interface EnterpriseHelpOpenOptions {
  readonly api: EnterpriseHelpApiPort
  /** 由 `enterpriseHelpUrl` 派生的地址；调用方已确认平台地址存在。 */
  readonly url: string
  readonly signal?: AbortSignal | undefined
  /** 浏览器兜底；测试注入假实现，运行时就是 `window.open`。 */
  readonly openWindow?: ((url: string, target: string, features: string) => unknown) | undefined
}

/**
 * 帮助入口的唯一执行口径：先请 Host 用系统浏览器打开（与 PKCE 登录同一条通道，桌面端才能真的离开
 * 应用窗口），Host 路由缺席或失败时退 `window.open(url, '_blank', 'noopener')`；两条路都失败才如实回报
 * `failed`，由调用方给出可见提示——绝不静默。
 */
export async function openEnterpriseHelp(options: EnterpriseHelpOpenOptions): Promise<EnterpriseHelpOutcome> {
  const signal = options.signal ?? new AbortController().signal
  try {
    await options.api.openHelp(signal)
    return 'host'
  } catch {
    // 退到浏览器兜底：`noopener` 是硬要求，被打开的站点拿不到我们的 window 句柄。
    const openWindow = options.openWindow ?? ((url: string, target: string, features: string) =>
      globalThis.open(url, target, features))
    try {
      openWindow(options.url, '_blank', 'noopener')
      return 'window'
    } catch {
      return 'failed'
    }
  }
}
