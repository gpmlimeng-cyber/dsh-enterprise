/**
 * [INPUT]: 依赖 OpenAPI 固定角色类型与 Lucide 免费图标。
 * [OUTPUT]: 提供九个导航页面、隐藏用户中心的静态元数据、四个静态侧栏分组（组名 + 组内路由）、路径判断、按角色过滤后的非空分组与多角色页面并集。
 * [POS]: app 的唯一控制台路由、前端页面可见性与侧栏分组真源，Server ent:* 权限仍独立裁决 API。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Activity, BookOpen, Boxes, CircleUserRound, MessageSquare, Palette, Puzzle, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { AuthBuiltInRole } from '@/api/generated/types.gen';

type ProductRouteDefinition = {
  to: '/' | '/access' | '/plugins' | '/presets' | '/skills' | '/branding' | '/feedback' | '/members' | '/activity';
  label: string;
  icon: LucideIcon;
  allowedRoles: readonly AuthBuiltInRole[];
};

export const PRODUCT_ROUTES = [
  { to: '/', label: '模型', icon: Boxes, allowedRoles: ['enterprise_admin', 'model_admin'] },
  { to: '/access', label: '访问策略', icon: ShieldCheck, allowedRoles: ['enterprise_admin', 'model_admin'] },
  { to: '/plugins', label: '插件', icon: Puzzle, allowedRoles: ['enterprise_admin', 'plugin_admin'] },
  { to: '/presets', label: '配方', icon: BookOpen, allowedRoles: ['enterprise_admin', 'plugin_admin'] },
  { to: '/skills', label: '技能', icon: Sparkles, allowedRoles: ['enterprise_admin', 'plugin_admin'] },
  { to: '/branding', label: '品牌', icon: Palette, allowedRoles: ['enterprise_admin'] },
  { to: '/feedback', label: '反馈', icon: MessageSquare, allowedRoles: ['enterprise_admin'] },
  { to: '/members', label: '成员', icon: Users, allowedRoles: ['enterprise_admin'] },
  { to: '/activity', label: '活动记录', icon: Activity, allowedRoles: ['enterprise_admin', 'model_admin', 'plugin_admin', 'auditor'] }
] as const satisfies readonly ProductRouteDefinition[];

export type ProductRouteItem = (typeof PRODUCT_ROUTES)[number];

export type ProductRouteGroupKey = 'models' | 'content' | 'org' | 'audit';

type ProductRouteGroupDefinition = {
  key: ProductRouteGroupKey;
  /** 组名只用于可访问性标注与测试锚点；侧栏视觉上只用分割线区隔，不新增标题样式。 */
  label: string;
  routes: readonly ProductRouteItem['to'][];
};

/**
 * 侧栏静态分组：按「同一批角色可见 + 业务上是同一件事」切分，数组顺序即侧栏顺序。
 * 不建「概览」组：控制台没有独立仪表盘页，根路径 `/` 是模型目录，改造它等于同时改路由与角色矩阵。
 */
export const PRODUCT_ROUTE_GROUPS = [
  { key: 'models', label: '模型与授权', routes: ['/', '/access'] },
  { key: 'content', label: '技能与插件', routes: ['/plugins', '/presets', '/skills'] },
  { key: 'org', label: '企业与组织', routes: ['/branding', '/feedback', '/members'] },
  { key: 'audit', label: '审计与运维', routes: ['/activity'] }
] as const satisfies readonly ProductRouteGroupDefinition[];

export type ProductRouteGroup = {
  key: ProductRouteGroupKey;
  label: string;
  items: ProductRouteItem[];
};

const ROUTE_BY_PATH = new Map<ProductRouteItem['to'], ProductRouteItem>(
  PRODUCT_ROUTES.map((route) => [route.to, route] as const)
);

/**
 * 角色过滤后的侧栏分组：保持静态顺序，整组没有任何可见项时直接剔除该组，
 * 调用方据此不必渲染「孤立分割线」（`/403` 已保证至少一组非空）。
 */
export function productRouteGroupsFor(roles: readonly AuthBuiltInRole[]): ProductRouteGroup[] {
  return PRODUCT_ROUTE_GROUPS.flatMap((group) => {
    const items = group.routes
      .map((to) => ROUTE_BY_PATH.get(to))
      .filter((route): route is ProductRouteItem => route !== undefined)
      .filter((route) => route.allowedRoles.some((role) => roles.includes(role)));
    return items.length > 0 ? [{ key: group.key, label: group.label, items }] : [];
  });
}

export const ACCOUNT_ROUTE = { to: '/account', label: '用户中心', icon: CircleUserRound } as const;
export const CONSOLE_ROUTES = [...PRODUCT_ROUTES, ACCOUNT_ROUTE] as const;

export type ProductRoute = (typeof CONSOLE_ROUTES)[number]['to'];

export function isProductRoute(pathname: string): pathname is ProductRoute {
  return CONSOLE_ROUTES.some((route) => route.to === pathname);
}

export function isAccountRoute(pathname: string) {
  return pathname === ACCOUNT_ROUTE.to || pathname === `${ACCOUNT_ROUTE.to}/security`;
}

/**
 * 角色并集后的侧栏页面：由分组拼接而成，使「侧栏能点的」与「路由守卫放行的」恒为同一集合
 * （分组覆盖全部 PRODUCT_ROUTES 由 product-routes.test.ts 的前两条用例锁定）。
 */
export function productRoutesFor(roles: readonly AuthBuiltInRole[]): ProductRouteItem[] {
  return productRouteGroupsFor(roles).flatMap((group) => group.items);
}
