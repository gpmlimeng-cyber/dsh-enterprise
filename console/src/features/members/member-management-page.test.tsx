/**
 * [INPUT]: 依赖 Testing Library、成员行标题列工厂与生成的成员摘要 DTO。
 * [OUTPUT]: 锁定"成员行标题即详情入口"：可聚焦 button、可读名带成员显示名、点击与回车都打开该成员详情，且行末箭头入口作为等价入口保留。
 * [POS]: features/members 的列表标题入口门禁，不启动路由与网络（跨页集成断言见 routes/-index.test.tsx）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberSummary } from '@/api/generated/types.gen';
import { memberColumns } from './member-management-page';

// vitest 未开 globals，Testing Library 的自动 cleanup 不会注册。
afterEach(cleanup);

const MEMBER: MemberSummary = {
  id: '202',
  username: 'developer.one',
  displayName: 'Developer One',
  status: 'ACTIVE',
  roles: ['employee'],
  loginMethods: [],
  lastActiveAt: null,
  revision: 1
};

/** 列定义对象上的 accessorKey 列由表格在运行时补全 id，这里两种键都认。 */
function columnFor<T extends { accessorKey?: string; id?: string }>(columns: ReadonlyArray<T>, key: string): T | undefined {
  return columns.find((candidate) => candidate.id === key || candidate.accessorKey === key);
}

/** 只渲染「成员」这一格，直接锁定标题入口与行末箭头入口，不牵扯表格状态机与请求。 */
function renderMemberCell(onOpen: (member: MemberSummary) => void) {
  const column = columnFor(memberColumns(onOpen), 'displayName');
  const renderCell = typeof column?.cell === 'function' ? column.cell : undefined;
  expect(renderCell).toBeDefined();
  render(<>{renderCell!({ row: { original: MEMBER } } as never)}</>);
}

describe('成员行标题入口', () => {
  it('keeps the display name as a focusable entry whose accessible name carries the member name', () => {
    const onOpen = vi.fn();
    renderMemberCell(onOpen);

    const title = screen.getByRole('button', { name: '查看 Developer One 的详情' });
    expect(title.tagName).toBe('BUTTON');
    expect(title.tabIndex).toBe(0);
    expect(title.textContent).toBe('Developer One');
    // 可读名不是裸「详情」，屏幕阅读器能分辨是哪一位成员。
    expect(title.getAttribute('aria-label')).not.toBe('详情');
    // 次要行（用户名）保持纯文本，不额外制造入口。
    expect(screen.getByText('developer.one').tagName).toBe('DIV');

    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(MEMBER);
  });

  it('activates with Enter so a member detail can be opened from the keyboard alone', () => {
    const onOpen = vi.fn();
    renderMemberCell(onOpen);

    fireEvent.keyDown(screen.getByRole('button', { name: '查看 Developer One 的详情' }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps the row-end arrow action column separate from the title entry', () => {
    const columns = memberColumns(vi.fn());
    const actions = columnFor(columns, 'actions');
    expect(actions).toBeDefined();
    // 标题入口只加在标题列，操作列没有被改造成第二个标题入口。
    expect(columnFor(columns, 'displayName')).toBeDefined();
    expect(columns.filter((candidate) => columnFor([candidate], 'displayName') !== undefined)).toHaveLength(1);
    expect(actions?.meta).toMatchObject({ label: '操作' });
  });
});
