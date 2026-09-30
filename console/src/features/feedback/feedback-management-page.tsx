/**
 * [INPUT]: 依赖生成的反馈管理 operation、console 权限事实、TanStack InfiniteQuery、成员目录、ProductDataTable 与反馈详情视图。
 * [OUTPUT]: 提供状态分段筛选、keyset 续页列表、详情弹窗与分诊/解决/忽略动作。
 * [POS]: features/feedback 的产品反馈工作台；服务端独占状态机、revision CAS 与审计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { changeFeedbackStatus, getFeedback, listFeedback } from '@/api/generated/sdk.gen';
import type {
  EnterpriseErrorResponse,
  FeedbackDetail,
  FeedbackItem as FeedbackItemDto,
  FeedbackPageData,
  FeedbackStatus
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ProductDataTable, type ProductTableColumn } from '@/components/product/DataTable';
import { useMembers } from '@/features/member-select';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_TONES,
  FEEDBACK_TYPE_LABELS,
  FeedbackDetailDialog
} from './feedback-editors';

export { nextStatuses } from './feedback-editors';

/** 分段筛选与服务端 status 查询参数一一对应；「全部」表示不带筛选。 */
export const FEEDBACK_SECTIONS = ['全部', '待分诊', '已分诊', '已解决', '已忽略'] as const;
export type FeedbackSection = (typeof FEEDBACK_SECTIONS)[number];

const SECTION_STATUS: Record<FeedbackSection, FeedbackStatus | undefined> = {
  全部: undefined,
  待分诊: 'new',
  已分诊: 'triaged',
  已解决: 'resolved',
  已忽略: 'ignored'
};

/** 提交体只含白名单字段：目标状态 + 去空白后为空则 null 的备注。 */
export function statusChangeBody(status: FeedbackStatus, note: string) {
  const trimmed = note.trim();
  return { status, note: trimmed === '' ? null : trimmed };
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as EnterpriseErrorResponse).error;
    if (payload?.message) return payload.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function unwrapData<T>(result: { data?: { data: T }; error?: EnterpriseErrorResponse }, fallback: string) {
  if (result.error !== undefined || result.data === undefined) throw new Error(errorMessage(result.error, fallback));
  return result.data.data;
}

function requireSuccess(result: { error?: EnterpriseErrorResponse }, fallback: string) {
  if (result.error !== undefined) throw new Error(errorMessage(result.error, fallback));
}

async function loadFeedback(status: FeedbackStatus | undefined, cursor?: string) {
  const result = await listFeedback({
    query: { limit: 50, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) }
  });
  return unwrapData<FeedbackPageData>(result, 'ENT_FEEDBACK_UNAVAILABLE');
}

export function formatFeedbackDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

type FeedbackRow = FeedbackItemDto & { submitterName: string };

function feedbackColumns(onOpen: (row: FeedbackRow) => void): ReadonlyArray<ProductTableColumn<FeedbackRow>> {
  return [
    {
      accessorKey: 'description',
      header: '反馈内容',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink" title={row.original.description}>{row.original.description}</div>
          <div className="truncate font-mono text-[11px] text-ink-3">
            {FEEDBACK_TYPE_LABELS[row.original.type]} · {row.original.id}
          </div>
        </div>
      ),
      meta: { label: '反馈内容', className: 'w-[420px]', cellClassName: 'w-[420px]' }
    },
    {
      accessorKey: 'submitterName',
      header: '提交员工',
      meta: { label: '提交员工', className: 'w-[170px]', cellClassName: 'w-[170px]' }
    },
    {
      id: 'attachmentCount',
      accessorFn: (row) => `${row.attachmentCount} 张`,
      header: '附件',
      meta: { label: '附件', className: 'w-[80px]', cellClassName: 'w-[80px]' }
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => <StatusPill tone={FEEDBACK_STATUS_TONES[row.original.status]}>{FEEDBACK_STATUS_LABELS[row.original.status]}</StatusPill>,
      meta: { label: '状态', className: 'w-[105px]', cellClassName: 'w-[105px]' }
    },
    {
      id: 'occurredAt',
      accessorFn: (row) => formatFeedbackDate(row.occurredAt),
      header: '发生时间',
      meta: { label: '发生时间', className: 'w-[160px]', cellClassName: 'w-[160px]' }
    },
    {
      id: 'actions',
      header: '操作',
      enableGlobalFilter: false,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="quiet"
          size="xs"
          className="size-7 rounded-md p-0"
          aria-label={`查看反馈 ${row.original.id}`}
          title="查看详情"
          onClick={() => onOpen(row.original)}
        >
          <Eye aria-hidden className="size-3.5" />
        </Button>
      ),
      meta: { label: '操作', className: 'w-[80px]', cellClassName: 'w-[80px]' }
    }
  ];
}

export function FeedbackManagementPage() {
  const { bootstrap } = useRouteContext({ from: '/_console' });
  const canWrite = bootstrap.permissions.includes('ent:feedback:write');
  const queryClient = useQueryClient();
  const [section, setSection] = useState<FeedbackSection>('全部');
  const [detailId, setDetailId] = useState<string>();
  const [note, setNote] = useState('');
  const status = SECTION_STATUS[section];
  const feedback = useInfiniteQuery({
    queryKey: ['feedback', status ?? 'all'],
    queryFn: ({ pageParam }) => loadFeedback(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.page.hasMore ? page.page.nextCursor ?? undefined : undefined),
    staleTime: 15_000
  });
  const members = useMembers(true);
  const detail = useQuery({
    queryKey: ['feedback', 'detail', detailId],
    queryFn: async () => unwrapData<FeedbackDetail>(
      await getFeedback({ path: { feedbackId: detailId ?? '' } }), 'ENT_FEEDBACK_DETAIL_UNAVAILABLE'
    ),
    enabled: detailId !== undefined
  });
  const changeStatus = useMutation({
    mutationFn: async ({ id, revision, status: target, note: text }: {
      id: string;
      revision: number;
      status: FeedbackStatus;
      note: string;
    }) => {
      requireSuccess(await changeFeedbackStatus({
        path: { feedbackId: id },
        headers: { 'If-Match': revision },
        body: statusChangeBody(target, text)
      }), 'ENT_FEEDBACK_STATUS_FAILED');
    },
    onSuccess: async () => {
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
    }
  });

  const memberNames = useMemo(
    () => new Map(members.data?.map((member) => [member.id, member.displayName]) ?? []),
    [members.data]
  );
  const rows = useMemo<FeedbackRow[]>(
    () => (feedback.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
      ...item,
      submitterName: memberNames.get(item.submitterId) ?? item.submitterId
    })),
    [feedback.data, memberNames]
  );
  const columns = useMemo(
    () => feedbackColumns((row) => {
      changeStatus.reset();
      setNote('');
      setDetailId(row.id);
    }),
    [changeStatus]
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div>
            <h1 className="m-0 text-[22px] font-semibold leading-tight text-ink">问题反馈</h1>
            <p className="m-0 mt-1 text-[12.5px] text-ink-3">
              员工提交的问题与建议按状态分诊；提交者、附件与诊断由服务端按会话与白名单裁剪。
            </p>
          </div>
          <SegmentedControl options={FEEDBACK_SECTIONS} value={section} onChange={setSection} />
        </header>
        <ProductDataTable
          ariaLabel="问题反馈"
          columns={columns}
          data={rows}
          emptyText="暂无反馈"
          error={feedback.error}
          getRowId={(row) => row.id}
          hasMore={feedback.hasNextPage}
          isLoading={feedback.isLoading}
          isLoadingMore={feedback.isFetchingNextPage}
          onLoadMore={() => void feedback.fetchNextPage()}
          onRetry={() => void feedback.refetch()}
          searchPlaceholder="搜索反馈内容或提交员工"
        />
      </div>
      {detailId !== undefined ? (
        <FeedbackDetailDialog
          canWrite={canWrite}
          detail={detail.data}
          error={changeStatus.error ? errorMessage(changeStatus.error, '反馈状态更新失败') : detail.error ? errorMessage(detail.error, '反馈详情加载失败') : undefined}
          loading={detail.isLoading}
          note={note}
          saving={changeStatus.isPending}
          onClose={() => { setDetailId(undefined); changeStatus.reset(); }}
          onNoteChange={setNote}
          onSave={(target, text, revision) => changeStatus.mutate({
            id: detailId, revision, status: target, note: text
          })}
        />
      ) : null}
    </div>
  );
}
