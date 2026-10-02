/**
 * [INPUT]: 依赖 Vitest 与 app/product-routes 的静态路由、分组真源。
 * [OUTPUT]: 锁定分组覆盖全部产品路由且不重复、组顺序与组内顺序、按角色的整组合并/剔除，以及扁平并集与分组的一致性。
 * [POS]: app 的侧栏分组单元门禁，只验证前端可见性，不替代 Server ent:* 权限测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import {
  PRODUCT_ROUTE_GROUPS,
  PRODUCT_ROUTES,
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
