/**
 * [INPUT]: 依赖 Testing Library、features/feedback 的纯投影 helper、行标题列工厂与生成的状态枚举。
 * [OUTPUT]: 锁定冻结分诊链路的前端下一步集合、处置请求只提交目标状态与去空白备注，以及"反馈行标题即详情入口"（可聚焦、可读名带行主体名、点击与回车都能打开详情）。
 * [POS]: features/feedback 的状态动作契约与列表标题入口门禁，不启动路由与网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackItem } from '@/api/generated/types.gen';
import { FEEDBACK_SECTIONS, feedbackColumns, nextStatuses, statusChangeBody } from './feedback-management-page';

// vitest 未开 globals，Testing Library 的自动 cleanup 不会注册。
afterEach(cleanup);

const ROW: FeedbackItem & { submitterName: string } = {
  id: 'feedback-1',
  type: 'issue',
  status: 'new',
  description: '导出按钮在移动端没有响应',
  contact: null,
  submitterId: '202',
  attachmentCount: 0,
  occurredAt: '2026-09-02T03:00:00Z',
  revision: 1,
  statusNote: null,
  statusChangedBy: null,
  statusChangedAt: null,
  createdAt: '2026-09-02T03:05:00Z',
  updatedAt: '2026-09-02T03:05:00Z',
  submitterName: 'Developer One'
};

/** 列定义对象上的 accessorKey 列由表格在运行时补全 id，这里两种键都认。 */
function columnFor<T extends { accessorKey?: string; id?: string }>(columns: ReadonlyArray<T>, key: string): T | undefined {
  return columns.find((candidate) => candidate.id === key || candidate.accessorKey === key);
}

/** 只渲染「反馈内容」这一格，直接锁定标题入口本身，不牵扯表格状态机与请求。 */
function renderTitleCell(onOpen: (row: FeedbackItem & { submitterName: string }) => void) {
  const column = columnFor(feedbackColumns(onOpen), 'description');
  const renderCell = typeof column?.cell === 'function' ? column.cell : undefined;
  expect(renderCell).toBeDefined();
  render(<>{renderCell!({ row: { original: ROW } } as never)}</>);
}

describe('nextStatuses', () => {
  it('mirrors the frozen server chain instead of offering free transitions', () => {
    expect(nextStatuses('new')).toEqual(['triaged']);
    expect(nextStatuses('triaged')).toEqual(['resolved', 'ignored']);
    expect(nextStatuses('resolved')).toEqual([]);
    expect(nextStatuses('ignored')).toEqual([]);
  });

  it('keeps one segment per server status filter plus the unfiltered default', () => {
    expect(FEEDBACK_SECTIONS).toEqual(['全部', '待分诊', '已分诊', '已解决', '已忽略']);
  });
});

describe('statusChangeBody', () => {
  it('sends only the target status and normalizes a blank note to null', () => {
    expect(statusChangeBody('triaged', '  已确认复现  ')).toEqual({ status: 'triaged', note: '已确认复现' });
    expect(statusChangeBody('resolved', '   ')).toEqual({ status: 'resolved', note: null });
    expect(statusChangeBody('ignored', '')).toEqual({ status: 'ignored', note: null });
    expect(Object.keys(statusChangeBody('triaged', 'x')).sort()).toEqual(['note', 'status']);
  });
});

describe('反馈行标题入口', () => {
  it('keeps the description as a focusable entry whose accessible name carries the row subject', () => {
    const onOpen = vi.fn();
    renderTitleCell(onOpen);

    const title = screen.getByRole('button', { name: '查看反馈 导出按钮在移动端没有响应 的详情' });
    expect(title.tagName).toBe('BUTTON');
    expect(title.tabIndex).toBe(0);
    expect(title.textContent).toBe('导出按钮在移动端没有响应');
    // 可读名不是裸「详情」，屏幕阅读器能分辨是哪一行。
    expect(title.getAttribute('aria-label')).not.toBe('详情');

    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // 传给详情打开逻辑的是整行，不是只有标题文本。
    expect(onOpen).toHaveBeenCalledWith(ROW);
  });

  it('activates with Enter so the row can be opened from the keyboard alone', () => {
    const onOpen = vi.fn();
    renderTitleCell(onOpen);

    fireEvent.keyDown(screen.getByRole('button', { name: /导出按钮在移动端没有响应/ }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
