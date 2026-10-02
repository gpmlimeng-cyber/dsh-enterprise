/**
 * [INPUT]: 依赖 Testing Library、Vitest 与共享行标题入口 RowTitleLink。
 * [OUTPUT]: 锁定"有详情才可点"的标题契约：按钮语义、带行主体名的可读名、Enter/Space 键盘激活、无详情时无按钮角色与无 hover 指针语义。
 * [POS]: components/product 的行标题门禁，防止台账列表退化成"看着能点却点不动"的死按钮或整行可点。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RowTitleLink } from './RowTitleLink';

afterEach(cleanup);

describe('RowTitleLink', () => {
  it('renders a focusable button whose accessible name carries the row subject when the row has a detail', () => {
    const onOpen = vi.fn();
    render(
      <RowTitleLink ariaLabel="查看 周报技能包 的详情" onOpen={onOpen}>
        周报技能包
      </RowTitleLink>
    );

    const title = screen.getByRole('button', { name: '查看 周报技能包 的详情' });
    expect(title.tagName).toBe('BUTTON');
    expect(title.getAttribute('type')).toBe('button');
    // 可聚焦：浏览器 tab 顺序与 Enter/Space 激活都依赖这两点。
    expect(title.hasAttribute('disabled')).toBe(false);
    expect(title.tabIndex).toBe(0);
    // 可读名不是裸「详情」，屏幕阅读器能分辨是哪一行。
    expect(title.textContent).toBe('周报技能包');
    expect(title.getAttribute('aria-label')).not.toBe('详情');

    fireEvent.click(title);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('activates on Enter and Space exactly once and keeps hover / focus-visible affordances', () => {
    const onOpen = vi.fn();
    render(
      <RowTitleLink ariaLabel="查看 周报技能包 的详情" onOpen={onOpen}>
        周报技能包
      </RowTitleLink>
    );
    const title = screen.getByRole('button', { name: '查看 周报技能包 的详情' });

    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(title, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);

    // 其它按键不激活，避免表格内误触。
    fireEvent.keyDown(title, { key: 'Tab' });
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(onOpen).toHaveBeenCalledTimes(2);

    // 悬停色、悬停下划线与焦点环都来自控制台既有 token，不做像素断言只锁类名契约。
    expect(title.className).toContain('hover:text-accent-ink');
    expect(title.className).toContain('hover:underline');
    expect(title.className).toContain('focus-visible:outline-accent');
  });

  it('keeps the title as plain unclickable text when the row has no detail', () => {
    render(<RowTitleLink ariaLabel="查看 周报技能包 的详情">周报技能包</RowTitleLink>);

    // 反向锁：没有详情就没有按钮角色、没有 pointer 指针语义，也没有任何详情可读名。
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByLabelText('查看 周报技能包 的详情')).toBeNull();
    const title = screen.getByText('周报技能包');
    expect(title.tagName).toBe('SPAN');
    expect(title.className).not.toContain('cursor-pointer');
    expect(title.className).not.toContain('hover:');
  });
});
