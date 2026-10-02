/**
 * [INPUT]: 汇总 Service、installation、PKCE 与回环结果页、系统浏览器、bootstrap 契约、settings 诊断、品牌缓存与 Harness WebServer 本地 API
 * [OUTPUT]: 对外提供 ctx.enterprisePlatform 实现、七个固定方法、稳定类型、组合端口（含企业技能安装的 `skillAction`/`skillStatus` 与只读正文的 `skillContent`）、四条技能同源路由的路径常量（`/skills/{install,uninstall,installed,content}`）、品牌缓存、回调页渲染与地址写入诊断串
 * [POS]: platform-client 的 package facade，屏蔽 Host 内部文件布局并保持无 Typert Remote 边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export * from './branding.js'
export * from './browser.js'
export * from './callback-page.js'
export * from './installation.js'
export * from './local-api.js'
export * from './pkce.js'
export * from './platform-service.js'
export * from './settings-diagnostics.js'
export * from './types.js'
