/**
 * [INPUT]: 依赖 Testing Library、Vitest、Lucide 图标与 primitives/SidebarNav。
 * [OUTPUT]: 锁定分组导航的组顺序/组内顺序、组间分割线位置（首尾不出现）、空组连同分割线消失、不传 navGroups 时的扁平向后兼容，以及底部纯图标工具条（三个原生可聚焦按钮、title + aria-label、无文字、不进主导航与分割线、折叠态转纵列）。
 * [POS]: primitives 侧栏分组与底部工具条的渲染门禁，不涉及路由与 Server 权限。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Activity, Boxes, BookOpen, CodeXml, ExternalLink, Puzzle, ShieldCheck, Sparkles } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/** 底部工具条：产品官网 / 帮助文档 / 接口文档，与产品壳注入的真源同形。 */
const UTILITY_ITEMS: SidebarNavItem[] = [
  { key: 'docs-site', label: '产品官网', icon: <ExternalLink size={18} /> },
  { key: 'docs-help', label: '帮助文档', icon: <BookOpen size={18} /> },
  { key: 'docs-api', label: '接口文档', icon: <CodeXml size={18} /> }
];

function renderSidebar(props: {
  navGroups?: SidebarNavGroup[];
  navItems?: SidebarNavItem[];
  utilityItems?: SidebarNavItem[];
  collapsible?: boolean;
  onNavigate?: (key: string) => void;
}) {
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
  it('按分组顺序渲染组与组内项，主导航里不再出现文档三项', () => {
    const { container } = renderSidebar({ navGroups: GROUPS, utilityItems: UTILITY_ITEMS });

    expect(screen.getByRole('group', { name: '模型与授权' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '技能与插件' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '审计与运维' })).toBeTruthy();

    const labelsIn = (key: string) => within(container.querySelector(`[data-nav-group="${key}"]`) as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labelsIn('models')).toEqual(['模型', '访问策略']);
    expect(labelsIn('content')).toEqual(['插件']);
    expect(labelsIn('audit')).toEqual(['活动记录']);

    // 反向锁：分组真源里没有 docs 组，三个文案既不作为主导航行、也不作为主导航文字出现
    expect(container.querySelector('[data-nav-group="docs"]')).toBeNull();
    expect(container.querySelectorAll('[data-nav-group]').length).toBe(GROUPS.length);
    const mainNav = within(container.querySelector('[data-nav-group]')!.parentElement as HTMLElement);
    for (const label of ['产品官网', '帮助文档', '接口文档']) {
      expect(mainNav.queryByRole('button', { name: label })).toBeNull();
      expect(screen.queryByText(label)).toBeNull();
    }
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
    // 不传 utilityItems 时不新增任何底部行，示例页与上游基线的 DOM 按钮数量不变
    expect(container.querySelector('[data-nav-utilities]')).toBeNull();
    expect(screen.getAllByRole('button').length).toBe(3);
  });
});

describe('SidebarNav 底部工具条（纯图标）', () => {
  it('常驻主导航下方的最底部，一行纯图标：每枚都有 title 与 aria-label，且不渲染文字', () => {
    const { container } = renderSidebar({ navGroups: GROUPS, utilityItems: UTILITY_ITEMS });

    const strip = container.querySelector('[data-nav-utilities]') as HTMLElement;
    expect(strip).toBeTruthy();
    // 位置：主导航所在内容列（GlideMenu 的父元素）的最后一个子元素
    const column = strip.parentElement as HTMLElement;
    expect(column.lastElementChild).toBe(strip);
    expect(column.firstElementChild).not.toBe(strip);
    // 与主导航之间一条分割线（沿用既有 border-line 取值）
    expect(strip.className).toContain('border-t');
    expect(strip.className).toContain('border-line');

    // 纯图标：不渲染任何文字节点（名称只由 title / aria-label 承载）
    expect(strip.textContent).toBe('');

    const buttons = within(strip).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label')))
      .toEqual(['产品官网', '帮助文档', '接口文档']);
    expect(buttons.map((button) => button.getAttribute('title')))
      .toEqual(['产品官网', '帮助文档', '接口文档']);
    // 每枚都是真图标（svg）+ 最小 32×32 可点面积
    expect(buttons.every((button) => button.querySelector('svg') !== null)).toBe(true);
    expect(buttons.every((button) => button.className.includes('size-8'))).toBe(true);
    // 底部条自带 role=group + 名称，摘出分组后「文档与支持」这一分组语义仍留在无障碍树里
    expect(screen.getByRole('group', { name: '文档与支持' })).toBe(strip);
  });

  it('每枚都是原生可聚焦 button，父容器不承担点击（没有挂在文字上的假按钮）', () => {
    const { container } = renderSidebar({ navGroups: GROUPS, utilityItems: UTILITY_ITEMS });
    const strip = container.querySelector('[data-nav-utilities]') as HTMLElement;

    // 父容器本身不可聚焦、也不是按钮，点击事件只挂在每枚 button 上
    expect(strip.tagName).toBe('DIV');
    expect(strip.getAttribute('role')).toBe('group');
    expect(strip.getAttribute('tabindex')).toBeNull();
    expect(strip.getAttribute('onclick')).toBeNull();
    expect(strip.querySelectorAll('button').length).toBe(3);

    for (const label of ['产品官网', '帮助文档', '接口文档']) {
      const button = within(strip).getByRole('button', { name: label });
      expect(button.tagName).toBe('BUTTON');
      // 原生可聚焦：没有 tabindex="-1" 之类的降级，键盘 Tab 可达
      expect(button.getAttribute('tabindex')).toBeNull();
      button.focus();
      expect(document.activeElement).toBe(button);
      // 反向：没有用可见文字冒充可点目标
      expect(within(strip).queryByText(label)).toBeNull();
    }
  });

  it('点击按 key 回调且不改变主导航选择，组间分割线行为保持不变', () => {
    const onNavigate = vi.fn();
    const { container } = renderSidebar({ navGroups: GROUPS, utilityItems: UTILITY_ITEMS, onNavigate });
    const strip = container.querySelector('[data-nav-utilities]') as HTMLElement;
    const activeInMainNav = () => Array.from(container.querySelectorAll('[data-nav-group] button'))
      .filter((button) => button.className.includes('bg-hover-2')).length;

    expect(activeInMainNav()).toBe(0);
    fireEvent.click(within(strip).getByRole('button', { name: '接口文档' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('docs-api');
    expect(activeInMainNav()).toBe(0);

    // 工具条不属于主导航列表：组与分割线序列与不传工具条时完全一致
    expect(navSequence(container)).toEqual([
      'group:models',
      'divider',
      'group:content',
      'divider',
      'group:audit'
    ]);
    expect(container.querySelectorAll('[data-nav-divider]').length).toBe(GROUPS.length - 1);
    expect(container.querySelector('[data-nav-utilities] [data-nav-group]')).toBeNull();
    expect(container.querySelector('[data-nav-utilities] [data-nav-divider]')).toBeNull();
  });

  it('折叠态把工具条转为纵列，与主导航图标共用同一条 52px 图标轨（不溢出、不遮挡）', () => {
    const { container } = renderSidebar({ collapsible: true, navGroups: GROUPS, utilityItems: UTILITY_ITEMS });
    const aside = container.querySelector('aside') as HTMLElement;
    const strip = container.querySelector('[data-nav-utilities]') as HTMLElement;

    expect(aside.getAttribute('data-sidebar-collapsed')).toBe('false');
    // 展开态：横排
    expect(strip.className).toContain('flex-row');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(aside.getAttribute('data-sidebar-collapsed')).toBe('true');
    // 折叠态由 aside 上的 group/sidebar 标记驱动：纵列 + 左对齐，使图标圆心仍落在 x=26 的图标轨上
    expect(aside.className).toContain('group/sidebar');
    expect(strip.className).toContain('group-data-[sidebar-collapsed=true]/sidebar:flex-col');
    expect(strip.className).toContain('group-data-[sidebar-collapsed=true]/sidebar:items-start');
    // 三枚按钮在两种状态下都保持 ≥32×32，且不依赖文字（折叠时 .sidebar-copy 会被隐藏）
    const buttons = within(strip).getAllByRole('button');
    expect(buttons.length).toBe(3);
    expect(buttons.every((button) => button.className.includes('size-8'))).toBe(true);
    expect(strip.querySelectorAll('.sidebar-copy').length).toBe(0);
  });
});
