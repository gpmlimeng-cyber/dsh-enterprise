/**
 * [INPUT]: 仅依赖 platform-client 的 route 形状类型 `WebServerRoutePort`
 * [OUTPUT]: 导出逐行复刻引擎 `dsh-host-webserver` `match()` 的 `engineRouteMatch()` 与别名类型 `RegisteredRoute`
 * [POS]: bundle 测试侧的路由判定内核（非 spec，不被 vitest 收集）；与 platform-client 的同名文件逐字等价，让两个包的路由回归锁建立在同一套语义上——「prefix 注册 path 不许带尾斜杠」与「子路径动作必须靠 exact 表抢在 prefix 之前」这两条家族回归锁都完全建立在这个函数与真引擎一致之上
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { WebServerRoutePort } from '@dshent/platform-client'

/** 被测路由的形状：与 `webServer.register()` 的入参逐字一致。 */
export type RegisteredRoute = Parameters<WebServerRoutePort['register']>[0]

/**
 * 引擎 `dsh-host-webserver` 的匹配语义（`lib/index.js:322` 起的 `match()`）逐行照抄：
 * 先按整路径查 exact 表（命中即返回，**不做长度比较**）；miss 后才在 prefix 表里只认「路径段前缀」——
 * `pathname === prefix || pathname.startsWith(`${prefix}/`)`，多条命中取**最长** prefix。
 *
 * 之所以在测试里复刻而不调用真引擎：真引擎是 Cordis Service，起它要重启 DSH（本机禁止重启）。
 * 它与「裸 `pathname.startsWith(route.path)`」的假匹配器有本质差别：后者会把
 * `/presets-xyz` 误判成 `/presets` 的子路径（引擎要求边界处必须是 `/`），
 * 正是这类假匹配器让带尾斜杠的 prefix 在测试里「看起来是通的」——线上却空体 404。
 *
 * @param routes - 本包注册出来的全部路由；exact 与 prefix 混在一个数组里，与引擎的两张表同构。
 * @param pathname - 已去掉查询串的请求路径。
 * @returns 引擎实际会命中的那条路由；无命中返回 `undefined`。
 */
export function engineRouteMatch(
  routes: readonly RegisteredRoute[],
  pathname: string,
): RegisteredRoute | undefined {
  const exact = routes.find(route => route.kind === 'exact' && route.path === pathname)
  if (exact !== undefined) return exact
  let best: RegisteredRoute | undefined
  for (const route of routes) {
    if (route.kind !== 'prefix') continue
    if (pathname !== route.path && !pathname.startsWith(`${route.path}/`)) continue
    if (best === undefined || route.path.length > best.path.length) best = route
  }
  return best
}
