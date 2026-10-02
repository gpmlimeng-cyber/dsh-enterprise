/**
 * [INPUT]: 依赖 Testing Library、Vitest、Lucide 图标与 primitives/SidebarNav。
 * [OUTPUT]: 锁定分组导航的组顺序/组内顺序、组间分割线位置（首尾不出现）、空组连同分割线消失，以及不传 navGroups 时的扁平向后兼容。
 * [POS]: primitives 侧栏分组的渲染门禁，不涉及路由与 Server 权限。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { Activity, Boxes, Puzzle, ShieldCheck, Sparkles } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import SidebarNav, { type SidebarNavGroup, type SidebarNavItem } from './SidebarNav';

afterEach(cleanup);

const GROUPS: SidebarNavGroup[] = [
  {
    key: 'models',
    label: '模型与授权',
    items: [
      { key: '/', label: '模型', icon: <Boxes size={18} /> },
      { key: '/access', label: '访问策略', icon: <ShieldCheck size={18} /> }
    ]
  },
  {
    key: 'content',
    label: '技能与插件',
    items: [{ key: '/plugins', label: '插件', icon: <Puzzle size={18} /> }]
  },
  {
    key: 'audit',
    label: '审计与运维',
    items: [{ key: '/activity', label: '活动记录', icon: <Activity size={18} /> }]
  }
];

function renderSidebar(props: { navGroups?: SidebarNavGroup[]; navItems?: SidebarNavItem[] }) {
  return render(
    <SidebarNav
      collapsible={false}
      footerLabel={null}
      historyLabel={null}
      primaryAction={null}
      {...props}
    />
  );
}

/** 主导航容器里按文档顺序排列的「组 / 分割线」序列。 */
function navSequence(container: HTMLElement): string[] {
  const list = container.querySelector('[data-nav-group]')?.parentElement
    ?? container.querySelector('[data-nav-divider]')?.parentElement;
  if (!list) return [];
  return Array.from(list.querySelectorAll(':scope > [data-nav-group], :scope > [data-nav-divider]'))
    .map((element) => (element.hasAttribute('data-nav-divider')
      ? 'divider'
      : `group:${element.getAttribute('data-nav-group')}`));
}

describe('SidebarNav 分组导航', () => {
  it('按分组顺序渲染组与组内项', () => {
    const { container } = renderSidebar({ navGroups: GROUPS });

    expect(screen.getByRole('group', { name: '模型与授权' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '技能与插件' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '审计与运维' })).toBeTruthy();

    const labelsIn = (key: string) => within(container.querySelector(`[data-nav-group="${key}"]`) as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labelsIn('models')).toEqual(['模型', '访问策略']);
    expect(labelsIn('content')).toEqual(['插件']);
    expect(labelsIn('audit')).toEqual(['活动记录']);

    expect(screen.queryByRole('button', { name: '产品官网' })).toBeNull();
  });

  it('只在组之间渲染分割线，首组前与末组后都没有', () => {
    const { container } = renderSidebar({ navGroups: GROUPS });

    expect(navSequence(container)).toEqual([
      'group:models',
      'divider',
      'group:content',
      'divider',
      'group:audit'
    ]);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(GROUPS.length - 1);
  });

  it('整组无可见项时连组带分割线一起消失，不出现孤立分割线', () => {
    const withEmptyGroup = [GROUPS[0]!, { key: 'content', label: '技能与插件', items: [] }, GROUPS[2]!];
    const { container } = renderSidebar({ navGroups: withEmptyGroup });

    expect(navSequence(container)).toEqual(['group:models', 'divider', 'group:audit']);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(1);
    expect(screen.queryByRole('group', { name: '技能与插件' })).toBeNull();
  });

  it('所有组都无可见项时，导航区既不渲染组也不渲染分割线', () => {
    const { container } = renderSidebar({
      navGroups: [{ key: 'models', label: '模型与授权', items: [] }, { key: 'audit', label: '审计与运维', items: [] }]
    });

    expect(navSequence(container)).toEqual([]);
    expect(container.querySelectorAll('[data-nav-group]').length).toBe(0);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(0);
  });

  it('未传 navGroups 时保持既有扁平渲染，且不出现分割线或组语义', () => {
    const { container } = renderSidebar({
      navItems: [
        { key: 'home', label: 'Home', icon: <Sparkles size={18} /> },
        { key: 'invite', label: 'Invite users', icon: <Sparkles size={18} /> }
      ]
    });

    expect(screen.getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Creamery Ops', 'Home', 'Invite users']);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(0);
    expect(container.querySelectorAll('[data-nav-group]').length).toBe(0);
  });

  it('默认（示例页）仍渲染上游扁平项，行为不变', () => {
    const { container } = render(<SidebarNav collapsible={false} footerLabel={null} historyLabel={null} primaryAction={null} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Creamery Ops', 'Home', 'Invite users3/10']);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(0);
  });
});
