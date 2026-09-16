/**
 * [INPUT]: 依赖生成的 getUsageAnalytics、TanStack Query、产品表格与成员选择。
 * [OUTPUT]: 提供时间范围/成员/模型筛选下的用量分析：摘要卡、日趋势条形、模型与成员分解表。
 * [POS]: features/activity 的分析视图；只读 ent_usage_ledger 聚合，不引入价格或成本字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getUsageAnalytics } from '@/api/generated/sdk.gen';
import type {
  EnterpriseErrorResponse,
  QuotaUsageAnalyticsData,
  QuotaUsageAnalyticsDayPoint,
  QuotaUsageAnalyticsModelRow,
  QuotaUsageAnalyticsMemberRow
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { ProductDataTable, type ProductTableColumn } from '@/components/product/DataTable';
import { MemberSelect } from '@/features/member-select';

const RANGES = ['近 7 天', '近 30 天', '近 90 天', '自定义'] as const;
type RangeKey = (typeof RANGES)[number];

function tokens(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function ratio(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as EnterpriseErrorResponse).error;
    if (payload?.message) return payload.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function unwrapData<T>(result: { data?: { data: T }; error?: EnterpriseErrorResponse }, fallback: string) {
  if (result.error !== undefined || result.data === undefined) throw new Error(errorMessage(result.error, fallback));
  return result.data.data;
}

function dayRange(days: number) {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

function toInputValue(value: string) {
  return value.slice(0, 10);
}

function fromInputValue(value: string, endOfDay = false) {
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return date.toISOString();
}

const modelColumns: ReadonlyArray<ProductTableColumn<QuotaUsageAnalyticsModelRow>> = [
  {
    accessorKey: 'displayName',
    header: '模型',
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.displayName}</div>
        <div className="truncate font-mono text-[11px] text-ink-3">{row.original.alias}</div>
      </div>
    ),
    meta: { label: '模型', className: 'w-[220px]', cellClassName: 'w-[220px]' }
  },
  { accessorKey: 'requests', header: '请求', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '请求', className: 'w-[90px]', cellClassName: 'w-[90px]' } },
  { accessorKey: 'totalTokens', header: '实测总计', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '实测总计', className: 'w-[110px]', cellClassName: 'w-[110px]' } },
  { accessorKey: 'inputTokens', header: '输入', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '输入', className: 'w-[100px]', cellClassName: 'w-[100px]' } },
  { accessorKey: 'outputTokens', header: '输出', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '输出', className: 'w-[100px]', cellClassName: 'w-[100px]' } },
  { accessorKey: 'cacheTokens', header: '缓存', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '缓存', className: 'w-[100px]', cellClassName: 'w-[100px]' } },
  { accessorKey: 'chargedTokens', header: '配额扣额', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '配额扣额', className: 'w-[110px]', cellClassName: 'w-[110px]' } },
  { id: 'cacheHitRatio', accessorFn: (row) => ratio(row.cacheHitRatio), header: '缓存命中', meta: { label: '缓存命中', className: 'w-[110px]', cellClassName: 'w-[110px]' } }
];

const memberColumns: ReadonlyArray<ProductTableColumn<QuotaUsageAnalyticsMemberRow>> = [
  {
    accessorKey: 'displayName',
    header: '成员',
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.displayName}</div>
        <div className="truncate font-mono text-[11px] text-ink-3">{row.original.username}</div>
      </div>
    ),
    meta: { label: '成员', className: 'w-[200px]', cellClassName: 'w-[200px]' }
  },
  { accessorKey: 'requests', header: '请求', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '请求', className: 'w-[90px]', cellClassName: 'w-[90px]' } },
  { accessorKey: 'totalTokens', header: '实测总计', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '实测总计', className: 'w-[110px]', cellClassName: 'w-[110px]' } },
  { accessorKey: 'chargedTokens', header: '配额扣额', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '配额扣额', className: 'w-[110px]', cellClassName: 'w-[110px]' } },
  { accessorKey: 'inputTokens', header: '输入', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '输入', className: 'w-[100px]', cellClassName: 'w-[100px]' } },
  { accessorKey: 'outputTokens', header: '输出', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '输出', className: 'w-[100px]', cellClassName: 'w-[100px]' } },
  { accessorKey: 'cacheTokens', header: '缓存', cell: ({ getValue }) => tokens(Number(getValue())), meta: { label: '缓存', className: 'w-[100px]', cellClassName: 'w-[100px]' } }
];

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-4 py-3">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tabular-nums text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div> : null}
    </div>
  );
}

function DailyBars({ points }: { points: readonly QuotaUsageAnalyticsDayPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.totalTokens));
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="mb-3 text-[13px] font-medium text-ink">日趋势（实测总计）</div>
      {points.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-3">暂无数据</p>
      ) : (
        <div className="flex h-36 items-end gap-[3px]">
          {points.map((point) => {
            const height = Math.max(2, Math.round((point.totalTokens / max) * 120));
            return (
              <div
                key={point.date}
                className="group relative min-w-0 flex-1 rounded-sm bg-accent/80"
                style={{ height }}
                title={`${point.date} · ${tokens(point.totalTokens)} tokens · ${tokens(point.requests)} 次`}
              />
            );
          })}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[11px] text-ink-3">
        <span>{points[0]?.date ?? '-'}</span>
        <span>{points[points.length - 1]?.date ?? '-'}</span>
      </div>
    </div>
  );
}

export function UsageAnalyticsPanel() {
  const [range, setRange] = useState<RangeKey>('近 30 天');
  const customInitial = useMemo(() => dayRange(30), []);
  const [customFrom, setCustomFrom] = useState(toInputValue(customInitial.from));
  const [customTo, setCustomTo] = useState(toInputValue(new Date().toISOString()));
  const [userId, setUserId] = useState('');
  const [modelId, setModelId] = useState('');

  const window = useMemo(() => {
    if (range !== '自定义') {
      const days = range === '近 7 天' ? 7 : range === '近 30 天' ? 30 : 90;
      return dayRange(days);
    }
    return {
      from: fromInputValue(customFrom),
      to: fromInputValue(customTo, true)
    };
  }, [range, customFrom, customTo]);

  const analytics = useQuery({
    queryKey: ['activity', 'usage-analytics', window.from, window.to, userId, modelId],
    queryFn: async () => {
      const result = await getUsageAnalytics({
        query: {
          from: window.from,
          to: window.to,
          ...(userId ? { userId } : {}),
          ...(modelId ? { modelId } : {})
        }
      });
      return unwrapData<QuotaUsageAnalyticsData>(result, '用量分析读取失败');
    },
    staleTime: 15_000
  });

  const data = analytics.data;
  const summary = data?.summary;
  const modelRows = data?.byModel ?? [];
  const memberRows = data?.byMember ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl options={RANGES} value={range} onChange={setRange} />
        {range === '自定义' ? (
          <>
            <label className="grid gap-1 text-[12px] text-ink-2">
              开始日期
              <input type="date" className="h-9 rounded-lg border border-line bg-canvas px-2 text-[13px]" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            </label>
            <label className="grid gap-1 text-[12px] text-ink-2">
              结束日期
              <input type="date" className="h-9 rounded-lg border border-line bg-canvas px-2 text-[13px]" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </label>
          </>
        ) : null}
        <label className="grid min-w-[160px] gap-1 text-[12px] text-ink-2">
          成员
          <MemberSelect value={userId} onValueChange={setUserId} />
        </label>
        <label className="grid min-w-[180px] gap-1 text-[12px] text-ink-2">
          模型 ID
          <input
            className="h-9 rounded-lg border border-line bg-canvas px-3 text-[13px]"
            placeholder="可选受管模型 ID"
            value={modelId}
            onChange={(event) => setModelId(event.target.value.trim())}
          />
        </label>
        <Button size="sm" onClick={() => void analytics.refetch()}>刷新</Button>
      </div>

      {analytics.error ? <p role="alert" className="m-0 text-[12.5px] text-red">{errorMessage(analytics.error, '用量分析读取失败')}</p> : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="请求数" value={tokens(summary.requests)} hint={`已实测 ${tokens(summary.settled)} · 未知 ${tokens(summary.unmeasured)}`} />
            <SummaryCard label="实测总计" value={tokens(summary.totalTokens)} />
            <SummaryCard label="配额扣额" value={tokens(summary.chargedTokens)} hint="含用量未知估算" />
            <SummaryCard label="输入 / 输出" value={`${tokens(summary.inputTokens)} / ${tokens(summary.outputTokens)}`} />
            <SummaryCard label="缓存命中率" value={ratio(summary.cacheHitRatio)} hint={`缓存 ${tokens(summary.cacheTokens)}`} />
          </div>
          <DailyBars points={data?.byDay ?? []} />
          {data?.truncated ? <p className="m-0 text-[12px] text-ink-3">模型或成员超过 50 行，仅展示合计最高的前 50 项。</p> : null}
          <ProductDataTable
            ariaLabel="按模型用量"
            columns={modelColumns}
            data={modelRows}
            emptyText="该时间范围内暂无模型用量"
            error={analytics.error}
            getRowId={(row) => String(row.modelId)}
            hasMore={false}
            isLoading={analytics.isLoading}
            onRetry={() => void analytics.refetch()}
            searchPlaceholder="搜索模型"
          />
          <ProductDataTable
            ariaLabel="按成员用量"
            columns={memberColumns}
            data={memberRows}
            emptyText="该时间范围内暂无成员用量"
            error={analytics.error}
            getRowId={(row) => String(row.userId)}
            hasMore={false}
            isLoading={analytics.isLoading}
            onRetry={() => void analytics.refetch()}
            searchPlaceholder="搜索成员"
          />
        </>
      ) : analytics.isLoading ? (
        <p className="m-0 text-[13px] text-ink-3">正在加载用量分析…</p>
      ) : (
        <p className="m-0 text-[13px] text-ink-3">暂无用量分析数据</p>
      )}
    </div>
  );
}
