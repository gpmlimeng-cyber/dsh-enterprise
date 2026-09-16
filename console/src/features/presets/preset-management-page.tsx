/**
 * [INPUT]: 依赖生成的配方管理 operation、浏览器原生 multipart、成员目录、console 权限事实、TanStack Query、ProductDataTable 与 lib/crypto 幂等键。
 * [OUTPUT]: 提供企业配方版本/可见范围两视图，以及上传、发布、退休与原子范围替换动作。
 * [POS]: features/presets 的产品配方工作台；服务端独占验包、CAS、状态机与逐请求下载授权。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Archive, CloudUpload, Settings2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  listPresetPackages,
  publishPresetVersion,
  replacePresetAssignments,
  retirePresetVersion,
  uploadPresetVersion
} from '@/api/generated/sdk.gen';
import type {
  EnterpriseErrorResponse,
  PresetPresetAssignment,
  PresetPresetAssignmentSpec,
  PresetPresetPackage,
  PresetPresetPackagePageData,
  PresetPresetVersion
} from '@/api/generated/types.gen';
import { randomUuid } from '@/lib/crypto';
import { Button } from '@/components/atoms/Button';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ProductDataTable, type ProductTableColumn } from '@/components/product/DataTable';
import { useMembers } from '@/features/member-select';
import {
  PresetAssignmentDialog,
  RetirePresetVersionDialog,
  UploadPresetVersionDialog,
  type PresetAssignmentValue,
  type PresetUploadValue
} from './preset-editors';

const SECTIONS = ['配方版本', '可见范围'] as const;

type PresetVersionRow = PresetPresetVersion & {
  displayName: string;
  packageRevision: number;
};

type PresetAssignmentRow = PresetPresetAssignment & {
  displayName: string;
  presetId: string;
  subjectName: string;
  sourceDshVersion: string;
};

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

export function serializePresetUpload(value: PresetUploadValue) {
  const body = new FormData();
  body.append('artifact', value.artifact);
  if (value.metadata) {
    body.append('metadata', new Blob([JSON.stringify(value.metadata)], { type: 'application/json' }));
  }
  return body;
}

async function loadPackages(cursor?: string) {
  const result = await listPresetPackages({ query: { limit: 100, ...(cursor ? { cursor } : {}) } });
  return unwrapData<PresetPresetPackagePageData>(result, 'ENT_PRESET_CATALOG_UNAVAILABLE');
}

function nextCursor(page: { page: { hasMore: boolean; nextCursor: string | null } }) {
  return page.page.hasMore ? page.page.nextCursor ?? undefined : undefined;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const VERSION_STATUS = {
  VALIDATED: { label: '已验证', tone: 'accent' },
  PUBLISHED: { label: '已发布', tone: 'green' },
  RETIRED: { label: '已退休', tone: 'neutral' }
} as const;

function VersionStatus({ status }: { status: PresetPresetVersion['status'] }) {
  const item = VERSION_STATUS[status];
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

const versionColumns: ReadonlyArray<ProductTableColumn<PresetVersionRow>> = [
  {
    accessorKey: 'displayName',
    header: '配方',
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink" title={row.original.displayName}>{row.original.displayName}</div>
        <div className="truncate font-mono text-[11px] text-ink-3" title={row.original.presetId}>{row.original.presetId}</div>
      </div>
    ),
    meta: { label: '配方', className: 'w-[220px]', cellClassName: 'w-[220px]' }
  },
  {
    accessorKey: 'sourceDshVersion',
    header: 'DSH 基线',
    meta: { label: 'DSH 基线', className: 'w-[130px]', cellClassName: 'w-[130px]' }
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ getValue }) => <VersionStatus status={getValue() as PresetPresetVersion['status']} />,
    filterFn: 'equalsString',
    meta: { label: '状态', className: 'w-[105px]', cellClassName: 'w-[105px]' }
  },
  {
    id: 'sizeBytes',
    accessorFn: (row) => formatBytes(row.sizeBytes),
    header: '大小',
    meta: { label: '大小', className: 'w-[90px]', cellClassName: 'w-[90px]' }
  },
  {
    id: 'createdAt',
    accessorFn: (row) => formatDate(row.createdAt),
    header: '上传时间',
    meta: { label: '上传时间', className: 'w-[160px]', cellClassName: 'w-[160px]' }
  }
];

function versionColumnsWithActions(
  canWrite: boolean,
  disabled: boolean,
  onPublish: (version: PresetPresetVersion) => void,
  onRetire: (version: PresetPresetVersion) => void
): ReadonlyArray<ProductTableColumn<PresetVersionRow>> {
  if (!canWrite) return versionColumns;
  return [...versionColumns, {
    id: 'actions',
    header: '操作',
    enableGlobalFilter: false,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => row.original.status === 'VALIDATED' ? (
      <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={disabled} aria-label={`发布 ${row.original.presetId}`} title="发布" onClick={() => onPublish(row.original)}>
        <CloudUpload aria-hidden className="size-3.5" />
      </Button>
    ) : row.original.status === 'PUBLISHED' ? (
      <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={disabled} aria-label={`退休 ${row.original.presetId}`} title="退休" onClick={() => onRetire(row.original)}>
        <Archive aria-hidden className="size-3.5" />
      </Button>
    ) : null,
    meta: { label: '操作', className: 'w-[80px]', cellClassName: 'w-[80px]' }
  }];
}

const assignmentColumns: ReadonlyArray<ProductTableColumn<PresetAssignmentRow>> = [
  {
    accessorKey: 'displayName',
    header: '配方',
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{row.original.displayName}</div>
        <div className="truncate font-mono text-[11px] text-ink-3">{row.original.presetId}</div>
      </div>
    ),
    meta: { label: '配方', className: 'w-[220px]', cellClassName: 'w-[220px]' }
  },
  {
    accessorKey: 'sourceDshVersion',
    header: '已发布基线',
    meta: { label: '已发布基线', className: 'w-[130px]', cellClassName: 'w-[130px]' }
  },
  {
    accessorKey: 'subjectName',
    header: '可见成员',
    meta: { label: '可见成员', className: 'w-[220px]', cellClassName: 'w-[220px]' }
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ getValue }) => <StatusPill tone={getValue() === 'ACTIVE' ? 'green' : 'neutral'}>{getValue() === 'ACTIVE' ? '启用' : '停用'}</StatusPill>,
    filterFn: 'equalsString',
    meta: { label: '状态', className: 'w-[100px]', cellClassName: 'w-[100px]' }
  }
];

export function PresetManagementPage() {
  const { bootstrap } = useRouteContext({ from: '/_console' });
  const canWrite = bootstrap.permissions.includes('ent:preset:write');
  const queryClient = useQueryClient();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('配方版本');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [retireTarget, setRetireTarget] = useState<PresetPresetVersion>();
  const members = useMembers(section === '可见范围' || assignmentOpen);
  const packages = useInfiniteQuery({
    queryKey: ['presets', 'packages'],
    queryFn: ({ pageParam }) => loadPackages(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: 30_000
  });
  const upload = useMutation({
    mutationFn: async (value: PresetUploadValue) => {
      const result = await uploadPresetVersion({
        body: value,
        bodySerializer: () => serializePresetUpload(value),
        headers: { 'Idempotency-Key': randomUuid() }
      });
      requireSuccess(result, 'ENT_PRESET_UPLOAD_FAILED');
    },
    onSuccess: async () => {
      setUploadOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['presets', 'packages'] });
    }
  });
  const changeVersion = useMutation({
    mutationFn: async ({ action, version }: { action: 'publish' | 'retire'; version: PresetPresetVersion }) => {
      const options = { headers: { 'If-Match': version.revision }, path: { presetVersionId: version.id } };
      const result = action === 'publish'
        ? await publishPresetVersion(options)
        : await retirePresetVersion(options);
      requireSuccess(result, 'ENT_PRESET_VERSION_UPDATE_FAILED');
    },
    onSuccess: async (_data, variables) => {
      if (variables.action === 'retire') setRetireTarget(undefined);
      await queryClient.invalidateQueries({ queryKey: ['presets', 'packages'] });
    }
  });
  const saveAssignments = useMutation({
    mutationFn: async (value: PresetAssignmentValue) => {
      const result = await replacePresetAssignments({
        body: { assignments: value.assignments },
        headers: { 'Idempotency-Key': randomUuid(), 'If-Match': value.revision },
        path: { presetPackageId: value.packageId }
      });
      requireSuccess(result, 'ENT_PRESET_ASSIGNMENT_UPDATE_FAILED');
    },
    onSuccess: async () => {
      setAssignmentOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['presets', 'packages'] });
    }
  });
  const packageRows = useMemo(() => packages.data?.pages.flatMap((page) => page.items) ?? [], [packages.data]);
  const versionRows = useMemo(() => packageRows.flatMap((presetPackage) => presetPackage.versions.map((version) => ({
    ...version,
    displayName: presetPackage.displayName,
    packageRevision: presetPackage.revision
  }))), [packageRows]);
  const memberNames = useMemo(() => new Map(members.data?.map((member) => [member.id, member.displayName]) ?? []), [members.data]);
  const assignmentRows = useMemo(() => packageRows.flatMap((presetPackage) => presetPackage.assignments.map((assignment) => ({
    ...assignment,
    displayName: presetPackage.displayName,
    presetId: presetPackage.presetId,
    subjectName: assignment.subjectType === 'ALL'
      ? '所有成员'
      : memberNames.get(assignment.subjectId ?? '') ?? '未知成员',
    sourceDshVersion: presetPackage.versions.find((version) => version.status === 'PUBLISHED')?.sourceDshVersion ?? '-'
  }))), [memberNames, packageRows]);

  const table = section === '配方版本' ? (
    <ProductDataTable
      ariaLabel="配方版本"
      columns={versionColumnsWithActions(
        canWrite,
        changeVersion.isPending,
        (version) => changeVersion.mutate({ action: 'publish', version }),
        setRetireTarget
      )}
      data={versionRows}
      emptyText="暂无配方版本"
      error={packages.error}
      filter={{ columnId: 'status', label: '全部状态', options: Object.entries(VERSION_STATUS).map(([value, item]) => ({ label: item.label, value })) }}
      getRowId={(row) => row.id}
      hasMore={packages.hasNextPage}
      isLoading={packages.isLoading}
      isLoadingMore={packages.isFetchingNextPage}
      onLoadMore={() => void packages.fetchNextPage()}
      onRetry={() => void packages.refetch()}
      searchPlaceholder="搜索配方或 presetId"
      toolbarAction={canWrite ? (
        <Button variant="primary" size="xs" onClick={() => { upload.reset(); setUploadOpen(true); }}>
          <Upload aria-hidden className="size-3.5" />
          上传 .dshpreset
        </Button>
      ) : undefined}
    />
  ) : (
    <ProductDataTable
      ariaLabel="配方可见范围"
      columns={assignmentColumns}
      data={assignmentRows}
      emptyText="暂无可见范围"
      error={packages.error}
      filter={{ columnId: 'status', label: '全部状态', options: [{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'DISABLED' }] }}
      getRowId={(row) => row.id}
      hasMore={packages.hasNextPage}
      isLoading={packages.isLoading}
      isLoadingMore={packages.isFetchingNextPage}
      onLoadMore={() => void packages.fetchNextPage()}
      onRetry={() => void packages.refetch()}
      searchPlaceholder="搜索配方或成员"
      toolbarAction={canWrite ? (
        <Button variant="primary" size="xs" disabled={packageRows.length === 0} onClick={() => { saveAssignments.reset(); setAssignmentOpen(true); }}>
          <Settings2 aria-hidden className="size-3.5" />
          配置范围
        </Button>
      ) : undefined}
    />
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div>
            <h1 className="m-0 text-[22px] font-semibold leading-tight text-ink">企业配方</h1>
            <p className="m-0 mt-1 text-[12.5px] text-ink-3">托管 Desktop dsh-preset v1 包；发布后员工可在设置中浏览并复制导入指令。</p>
          </div>
          <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
        </header>
        {changeVersion.error && !retireTarget ? <p role="alert" className="m-0 text-[12.5px] text-red">{changeVersion.error.message}</p> : null}
        {table}
      </div>
      {uploadOpen ? (
        <UploadPresetVersionDialog
          error={upload.error?.message}
          saving={upload.isPending}
          onClose={() => setUploadOpen(false)}
          onSave={(value) => upload.mutate(value)}
        />
      ) : null}
      {assignmentOpen ? (
        <PresetAssignmentDialog
          error={saveAssignments.error?.message}
          packages={packageRows}
          saving={saveAssignments.isPending}
          onClose={() => setAssignmentOpen(false)}
          onSave={(value) => saveAssignments.mutate(value)}
        />
      ) : null}
      {retireTarget ? (
        <RetirePresetVersionDialog
          error={changeVersion.error?.message}
          saving={changeVersion.isPending}
          version={retireTarget}
          onClose={() => setRetireTarget(undefined)}
          onConfirm={() => changeVersion.mutate({ action: 'retire', version: retireTarget })}
        />
      ) : null}
    </div>
  );
}
