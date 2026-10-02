/**
 * [INPUT]: 依赖 Vitest 与 app/product-routes 的静态路由、主导航分组真源与底部工具项真源。
 * [OUTPUT]: 锁定分组覆盖全部产品路由且不重复、组顺序与组内顺序、按角色的整组合并/剔除、扁平并集与分组的一致性，以及文档与支持三项只作为底部工具项存在（不再进入主导航分组、不进路由与角色矩阵）。
 * [POS]: app 的侧栏分组与底部工具条单元门禁，只验证前端可见性，不替代 Server ent:* 权限测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import {
  PRODUCT_ROUTE_GROUPS,
  PRODUCT_ROUTES,
  PRODUCT_UTILITY_ROUTES,
  productRouteGroupsFor,
  productRoutesFor
} from './product-routes';

describe('product route groups', () => {
  it('把每一条产品路由恰好放进一个分组', () => {
    const grouped = PRODUCT_ROUTE_GROUPS.flatMap((group) => group.routes);
    expect(grouped).toEqual(PRODUCT_ROUTES.map((route) => route.to));
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('按固定组顺序与组内顺序渲染 enterprise_admin 的全部九项', () => {
    const groups = productRouteGroupsFor(['enterprise_admin']);
    expect(groups.map((group) => group.key)).toEqual(['models', 'content', 'org', 'audit']);
    expect(groups.map((group) => group.label)).toEqual(['模型与授权', '技能与插件', '企业与组织', '审计与运维']);
    expect(groups.map((group) => group.items.map((route) => route.to))).toEqual([
      ['/', '/access'],
      ['/plugins', '/presets', '/skills'],
      ['/branding', '/feedback', '/members'],
      ['/activity']
    ]);
    expect(groups.flatMap((group) => group.items).map((route) => route.to))
      .toEqual(['/', '/access', '/plugins', '/presets', '/skills', '/branding', '/feedback', '/members', '/activity']);
  });

  it('剔除整组不可见的组，不残留空组', () => {
    const keysFor = (roles: Parameters<typeof productRouteGroupsFor>[0]) =>
      productRouteGroupsFor(roles).map((group) => group.key);
    expect(keysFor(['model_admin'])).toEqual(['models', 'audit']);
    expect(keysFor(['plugin_admin'])).toEqual(['content', 'audit']);
    expect(keysFor(['auditor'])).toEqual(['audit']);
    expect(keysFor(['employee'])).toEqual([]);
    expect(keysFor(['model_admin', 'plugin_admin'])).toEqual(['models', 'content', 'audit']);
  });

  it('分组并集与扁平 productRoutesFor 完全一致（含多角色并集与 employee）', () => {
    const roleSets = [
      ['enterprise_admin'],
      ['model_admin'],
      ['plugin_admin'],
      ['auditor'],
      ['employee'],
      ['model_admin', 'plugin_admin'],
      ['enterprise_admin', 'auditor']
    ] as const;
    for (const roles of roleSets) {
      expect(productRouteGroupsFor(roles).flatMap((group) => group.items).map((route) => route.to))
        .toEqual(productRoutesFor(roles).map((route) => route.to));
    }
  });

  it('组内每一项都仍然只由 allowedRoles 决定可见性', () => {
    for (const group of productRouteGroupsFor(['enterprise_admin'])) {
      for (const route of group.items) {
        expect(route.allowedRoles).toContain('enterprise_admin');
      }
    }
    // 反向：auditor 只可能在 audit 组看到活动记录
    expect(productRouteGroupsFor(['auditor'])[0]!.items.map((route) => route.to)).toEqual(['/activity']);
  });
});

describe('product utility routes（底部工具项）', () => {
  const DOC_LABELS = ['产品官网', '帮助文档', '接口文档'];

  it('真源里仍完整保留文档与支持三项，并显式标记为底部承载', () => {
    expect(PRODUCT_UTILITY_ROUTES.map((item) => item.key)).toEqual(['docs-site', 'docs-help', 'docs-api']);
    expect(PRODUCT_UTILITY_ROUTES.map((item) => item.label)).toEqual(DOC_LABELS);
    expect(PRODUCT_UTILITY_ROUTES.map((item) => item.href)).toEqual(['/home/', '/help/', '/api-docs/']);
    // `placement` 是「换承载位置而不是删除」的可校验表达
    expect(PRODUCT_UTILITY_ROUTES.every((item) => item.placement === 'utility')).toBe(true);
    expect(PRODUCT_UTILITY_ROUTES.every((item) => item.icon !== undefined)).toBe(true);
  });

  it('反向锁：主导航分组不再承载这三个条目', () => {
    expect(PRODUCT_ROUTE_GROUPS.map((group) => group.key)).toEqual(['models', 'content', 'org', 'audit']);
    for (const group of PRODUCT_ROUTE_GROUPS) {
      expect(group.label).not.toBe('文档与支持');
      for (const key of PRODUCT_UTILITY_ROUTES.map((item) => item.key)) {
        expect(group.routes as readonly string[]).not.toContain(key);
      }
    }
    for (const roles of [['enterprise_admin'], ['model_admin'], ['plugin_admin'], ['auditor']] as const) {
      // 类型上也已排除：ProductRouteGroupKey 不再包含 'docs'
      expect(productRouteGroupsFor(roles).map((group) => group.key as string)).not.toContain('docs');
    }
  });

  it('底部工具项不是路由：不进 PRODUCT_ROUTES / 角色矩阵 / 页面并集（路由与权限零改动）', () => {
    const routePaths = PRODUCT_ROUTES.map((route) => route.to as string);
    const routeLabels = PRODUCT_ROUTES.map((route) => route.label);
    for (const item of PRODUCT_UTILITY_ROUTES) {
      expect(routePaths).not.toContain(item.key);
      expect(routePaths).not.toContain(item.href);
      expect(routeLabels).not.toContain(item.label);
      expect(Object.keys(item)).not.toContain('allowedRoles');
    }
    expect(productRoutesFor(['enterprise_admin'])).toHaveLength(9);
    expect(productRoutesFor(['enterprise_admin']).map((route) => route.label)).not.toContain('产品官网');
  });
});
