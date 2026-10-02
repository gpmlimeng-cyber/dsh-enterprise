/**
 * [INPUT]: 依赖 Testing Library、Vitest 与 ProductDataTable 的 TanStack Table v9 行为。
 * [OUTPUT]: 验证搜索、精确筛选、行选择、列显隐和分页共享语义，并锁住失败态取文、加载中页脚与每页行数焦点环。
 * [POS]: components/product 的最小行为门禁，防止资源页面各自重复或破坏表格状态机。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ProductDataTable,
  type ProductTableColumn
} from './DataTable';

type Item = { id: string; name: string; status: 'ACTIVE' | 'DISABLED' };

const columns: ReadonlyArray<ProductTableColumn<Item>> = [
  { accessorKey: 'name', header: '名称', meta: { label: '名称' } },
  {
    accessorKey: 'status',
    header: '状态',
    filterFn: 'equalsString',
    meta: { label: '状态' }
  }
];

const data: Item[] = Array.from({ length: 11 }, (_, index) => ({
  id: String(index + 1),
  name: index === 10 ? 'Zulu' : `Item ${String(index + 1).padStart(2, '0')}`,
  status: index % 2 === 0 ? 'ACTIVE' : 'DISABLED'
}));

afterEach(cleanup);

describe('ProductDataTable', () => {
  it('keeps rich table behavior in one shared component', () => {
    render(
      <ProductDataTable
        ariaLabel="资源"
        columns={columns}
        data={data}
        emptyText="暂无资源"
        filter={{
          columnId: 'status',
          label: '全部状态',
          options: [
            { label: '启用', value: 'ACTIVE' },
            { label: '停用', value: 'DISABLED' }
          ]
        }}
        getRowId={(row) => row.id}
        searchPlaceholder="搜索资源"
      />
    );

    expect(screen.queryByText('Zulu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('Zulu')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索资源' }), { target: { value: 'Item 02' } });
    expect(screen.getByText('Item 02')).toBeTruthy();
    expect(screen.queryByText('Item 01')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索资源' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '全部状态' }), { target: { value: 'DISABLED' } });
    expect(screen.getByText('Item 02')).toBeTruthy();
    expect(screen.queryByText('Item 01')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: '选择第 1 行' }));
    expect(screen.getByRole('button', { name: '已选择 1 项' })).toBeTruthy();

    fireEvent.click(screen.getByText('列'));
    const menu = screen.getByText('列').closest('details')!;
    fireEvent.click(within(menu).getByRole('checkbox', { name: '状态' }));
    expect(screen.queryByRole('columnheader', { name: /状态/ })).toBeNull();
  });

  it('失败态显示企业错误信封里的服务端 message，而不是退化成兜底', () => {
    render(
      <ProductDataTable
        ariaLabel="资源"
        columns={columns}
        data={[]}
        emptyText="暂无资源"
        error={{ error: { code: 'ENT_PLUGIN_ASSIGNMENT_UPDATE_FAILED', message: '可见范围冲突' } }}
        getRowId={(row) => row.id}
        searchPlaceholder="搜索资源"
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('可见范围冲突');
    expect(screen.queryByText('暂时无法读取数据')).toBeNull();
  });

  it('加载中页脚显示占位符，不再同时说「正在读取」与「0 项」', () => {
    render(
      <ProductDataTable
        ariaLabel="资源"
        columns={columns}
        data={[]}
        emptyText="暂无资源"
        getRowId={(row) => row.id}
        isLoading
        searchPlaceholder="搜索资源"
      />
    );

    expect(screen.queryByText(/0 项/)).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('每页行数下拉与同一工具栏的搜索/筛选共用焦点环', () => {
    render(
      <ProductDataTable
        ariaLabel="资源"
        columns={columns}
        data={data}
        emptyText="暂无资源"
        getRowId={(row) => row.id}
        searchPlaceholder="搜索资源"
      />
    );

    const pageSize = screen.getByRole('combobox', { name: '每页行数' });
    expect(pageSize.className).toContain('focus:border-accent');
    expect(pageSize.className).toContain('focus:ring-2');
    expect(pageSize.className).toContain('focus:ring-accent-tint');
  });
});
