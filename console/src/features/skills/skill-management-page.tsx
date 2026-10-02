/**
 * [INPUT]: 依赖生成的技能管理 operation、浏览器原生 multipart、成员目录、console 权限事实、TanStack Query、ProductDataTable、RowTitleLink、lib/crypto 幂等键与 features/skills 编辑器。
 * [OUTPUT]: 提供 .dshskill 上传 serializer、包级列表行投影 toSkillPackageRow、技能工作台，以及"点标题开技能包详情"的共享入口与上传、发布、下架、全量范围替换的动作编排。
 * [POS]: features/skills 的产品工作台；一个技能包聚合多个 SKILL.md 条目，服务端独占验包、状态机、CAS 与逐请求下载授权。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Archive, CloudUpload, Eye, Settings2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  listSkillPackages,
  publishSkillVersion,
  replaceSkillAssignments,
  retireSkillVersion,
  uploadSkillVersion
} from '@/api/generated/sdk.gen';
import type {
  EnterpriseErrorResponse,
  SkillSkillPackage,
  SkillSkillPackagePageData,
  SkillSkillVersion,
  SkillSkillVersionStatus
} from '@/api/generated/types.gen';
import { errorMessage } from '@/lib/errors';
import { randomUuid } from '@/lib/crypto';
import { Button } from '@/components/atoms/Button';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ProductDataTable, type ProductTableColumn } from '@/components/product/DataTable';
import { RowTitleLink } from '@/components/product/RowTitleLink';
import { useMembers } from '@/features/member-select';
import {
  latestSkillVersionFrom,
  RetireSkillVersionDialog,
  SkillAssignmentDialog,
  SkillDetailDialog,
  SkillVersionStatusPill,
  UploadSkillVersionDialog,
  skillVisibilitySummary,
  type SkillAssignmentValue,
  type SkillUploadValue
} from './skill-editors';

function unwrapData<T>(result: { data?: { data: T }; error?: EnterpriseErrorResponse }, fallback: string) {
  if (result.error !== undefined || result.data === undefined) throw new Error(errorMessage(result.error, fallback));
  return result.data.data;
}

function requireSuccess(result: { error?: EnterpriseErrorResponse }, fallback: string) {
  if (result.error !== undefined) throw new Error(errorMessage(result.error, fallback));
}

export function serializeSkillUpload(value: SkillUploadValue) {
  const body = new FormData();
  body.append('artifact', value.artifact);
  if (value.metadata) {
    body.append('metadata', new Blob([JSON.stringify(value.metadata)], { type: 'application/json' }));
  }
  return body;
}

async function loadPackages(cursor?: string) {
  const result = await listSkillPackages({ query: { limit: 100, ...(cursor ? { cursor } : {}) } });
  return unwrapData<SkillSkillPackagePageData>(result, 'ENT_SKILL_CATALOG_UNAVAILABLE');
}

function nextCursor(page: { page: { hasMore: boolean; nextCursor: string | null } }) {
  return page.page.hasMore ? page.page.nextCursor ?? undefined : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

/* ── 列表行投影 ───────────────────────────────────────── */

/**
 * 工作台行把包与其最新版本折叠成一层。包自身的 ACTIVE/DISABLED 没有写入面可改，
 * 故 status 列复用契约里更可行动的版本状态（VALIDATED/PUBLISHED/RETIRED），无版本时用 EMPTY。
 */
export type SkillPackageRow = Omit<SkillSkillPackage, 'status'> & {
  /** 最新版本；发布/下架的行内动作与状态列都以它为准。 */
  latest?: SkillSkillVersion;
  status: SkillSkillVersionStatus | 'EMPTY';
  sourceDshVersion: string;
  skillCount: number;
  updatedAt?: string;
  visibility: string;
};

/**
 * 包级行：把 versions/assignments 折叠成工作台需要的七列。
 * 服务端没有 updatedAt，故沿用最新版本的 createdAt（版本只增不改，语义等价）。
 * 「技能包」标题是详情入口：onOpenTitle 由工作台注入 openDetail，标题因此与行末「详情」按钮等价；
 * 不再需要详情时传空回调即可让标题退回纯文本（不留下看着能点却点不动的死按钮）。
 */
export function toSkillPackageRow(skillPackage: SkillSkillPackage): SkillPackageRow {
  const latest = latestSkillVersionFrom(skillPackage.versions);
  return {
    ...skillPackage,
    latest,
    status: latest?.status ?? 'EMPTY',
    sourceDshVersion: latest?.sourceDshVersion ?? '-',
    skillCount: latest?.skillCount ?? 0,
    updatedAt: latest?.createdAt,
    visibility: skillVisibilitySummary(skillPackage.assignments)
  };
}

function skillColumns(onOpenTitle: (row: SkillPackageRow) => void): ReadonlyArray<ProductTableColumn<SkillPackageRow>> {
  return [
  {
    accessorKey: 'displayName',
    header: '技能包',
    cell: ({ row }) => (
      <div className="min-w-0">
        <RowTitleLink
          ariaLabel={`查看 ${row.original.displayName} 的详情`}
          className="block truncate"
          onOpen={() => onOpenTitle(row.original)}
        >
          <span className="truncate" title={row.original.displayName}>{row.original.displayName}</span>
        </RowTitleLink>
        <div className="truncate font-mono text-[11px] text-ink-3" title={row.original.skillId}>{row.original.skillId}</div>
      </div>
    ),
    meta: { label: '技能包', className: 'w-[240px]', cellClassName: 'w-[240px]' }
  },
  {
    accessorKey: 'sourceDshVersion',
    header: '最新基线',
    meta: { label: '最新基线', className: 'w-[130px]', cellClassName: 'w-[130px]' }
  },
  {
    accessorKey: 'skillCount',
    header: '技能数',
    meta: { label: '技能数', className: 'w-[90px]', cellClassName: 'w-[90px]' }
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ getValue }) => {
      const status = getValue() as SkillPackageRow['status'];
      return status === 'EMPTY' ? <StatusPill tone="neutral">暂无版本</StatusPill> : <SkillVersionStatusPill status={status} />;
    },
    filterFn: 'equalsString',
    meta: { label: '状态', className: 'w-[110px]', cellClassName: 'w-[110px]' }
  },
  {
    accessorKey: 'visibility',
    header: '可见范围',
    meta: { label: '可见范围', className: 'w-[120px]', cellClassName: 'w-[120px]' }
  },
  {
    id: 'updatedAt',
    accessorFn: (row) => row.updatedAt ? formatDate(row.updatedAt) : '-',
    header: '更新时间',
    meta: { label: '更新时间', className: 'w-[160px]', cellClassName: 'w-[160px]' }
  }
  ];
}

/**
 * 操作列始终存在：读权限（ent:skill:read）也能看详情，写动作单独按 canWrite 与版本状态收窄。
 * 「编辑范围」直达独立范围对话框，详情里另有同一份内联编辑器。
 */
function skillColumnsWithActions(
  canWrite: boolean,
  disabled: boolean,
  onDetail: (row: SkillPackageRow) => void,
  onEditAssignments: (row: SkillPackageRow) => void,
  onPublish: (version: SkillSkillVersion) => void,
  onRetire: (version: SkillSkillVersion) => void
): ReadonlyArray<ProductTableColumn<SkillPackageRow>> {
  return [...skillColumns(onDetail), {
    id: 'actions',
    header: '操作',
    enableGlobalFilter: false,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const latest = row.original.latest;
      return (
        <div className="flex items-center gap-0.5">
          {canWrite && latest?.status === 'VALIDATED' ? (
            <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={disabled} aria-label={`发布 ${row.original.skillId}`} title="发布最新版本" onClick={() => onPublish(latest)}>
              <CloudUpload aria-hidden className="size-3.5" />
            </Button>
          ) : null}
          {canWrite && latest?.status === 'PUBLISHED' ? (
            <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={disabled} aria-label={`下架 ${row.original.skillId}`} title="下架最新版本" onClick={() => onRetire(latest)}>
              <Archive aria-hidden className="size-3.5" />
            </Button>
          ) : null}
          {canWrite ? (
            <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={disabled} aria-label={`编辑 ${row.original.skillId} 的可见范围`} title="编辑可见范围" onClick={() => onEditAssignments(row.original)}>
              <Settings2 aria-hidden className="size-3.5" />
            </Button>
          ) : null}
          <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" aria-label={`查看 ${row.original.skillId} 详情`} title="详情" onClick={() => onDetail(row.original)}>
            <Eye aria-hidden className="size-3.5" />
          </Button>
        </div>
      );
    },
    meta: { label: '操作', className: 'w-[150px]', cellClassName: 'w-[150px]' }
  }];
}

export function SkillManagementPage() {
  const { bootstrap } = useRouteContext({ from: '/_console' });
  const canWrite = bootstrap.permissions.includes('ent:skill:write');
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentPackageId, setAssignmentPackageId] = useState<string>();
  const [detailPackageId, setDetailPackageId] = useState<string>();
  const [retireTarget, setRetireTarget] = useState<SkillSkillVersion>();
  const members = useMembers(assignmentOpen || detailPackageId !== undefined);
  const packages = useInfiniteQuery({
    queryKey: ['skills', 'packages'],
    queryFn: ({ pageParam }) => loadPackages(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    staleTime: 30_000
  });
  const upload = useMutation({
    mutationFn: async (value: SkillUploadValue) => {
      const result = await uploadSkillVersion({
        body: value,
        bodySerializer: () => serializeSkillUpload(value),
        headers: { 'Idempotency-Key': randomUuid() }
      });
      return unwrapData<SkillSkillVersion>(result, 'ENT_SKILL_UPLOAD_FAILED');
    },
    onSuccess: async () => {
      // 保持抽屉打开：documented 的服务端解析结果（manifest + SKILL.md 条目）正是管理员需要核对的确认页。
      await queryClient.invalidateQueries({ queryKey: ['skills', 'packages'] });
    }
  });
  const changeVersion = useMutation({
    mutationFn: async ({ action, version }: { action: 'publish' | 'retire'; version: SkillSkillVersion }) => {
      const options = { headers: { 'If-Match': version.revision }, path: { skillVersionId: version.id } };
      const result = action === 'publish'
        ? await publishSkillVersion(options)
        : await retireSkillVersion(options);
      requireSuccess(result, 'ENT_SKILL_VERSION_UPDATE_FAILED');
    },
    onSuccess: async (_data, variables) => {
      if (variables.action === 'retire') setRetireTarget(undefined);
      await queryClient.invalidateQueries({ queryKey: ['skills', 'packages'] });
    }
  });
  const saveAssignments = useMutation({
    mutationFn: async (value: SkillAssignmentValue) => {
      const result = await replaceSkillAssignments({
        body: { assignments: value.assignments },
        headers: { 'Idempotency-Key': randomUuid(), 'If-Match': value.revision },
        path: { skillPackageId: value.packageId }
      });
      requireSuccess(result, 'ENT_SKILL_ASSIGNMENT_UPDATE_FAILED');
    },
    onSuccess: async () => {
      // 详情内的编辑器保存后不关闭详情：列表失效会带来新的 revision，管理员可以继续核对。
      setAssignmentOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['skills', 'packages'] });
    }
  });
  const packageRows = useMemo(() => packages.data?.pages.flatMap((page) => page.items) ?? [], [packages.data]);
  const rows = useMemo(() => packageRows.map(toSkillPackageRow), [packageRows]);
  const memberNames = useMemo(() => new Map(members.data?.map((member) => [member.id, member.displayName]) ?? []), [members.data]);
  const detailPackage = detailPackageId ? packageRows.find((item) => item.id === detailPackageId) : undefined;

  const openDetail = (row: SkillPackageRow) => {
    changeVersion.reset();
    setDetailPackageId(row.id);
  };
  const openAssignments = (row: SkillPackageRow) => {
    saveAssignments.reset();
    setAssignmentPackageId(row.id);
    setAssignmentOpen(true);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9">
        <header className="border-b border-line pb-5">
          <h1 className="m-0 text-[22px] font-semibold leading-tight text-ink">企业技能</h1>
          <p className="m-0 mt-1 text-[12.5px] text-ink-3">
            托管 dsh-skill v1 的 .dshskill 技能包；一个包可含多个 SKILL.md 技能条目，发布后对可见范围内员工的 Agent 生效。
          </p>
        </header>
        {changeVersion.error && !retireTarget ? <p role="alert" className="m-0 text-[12.5px] text-red">{errorMessage(changeVersion.error, '技能版本操作失败')}</p> : null}
        <ProductDataTable
          ariaLabel="技能包目录"
          columns={skillColumnsWithActions(
            canWrite,
            changeVersion.isPending,
            openDetail,
            openAssignments,
            (version) => changeVersion.mutate({ action: 'publish', version }),
            setRetireTarget
          )}
          data={rows}
          emptyText="暂无技能包"
          error={packages.error}
          filter={{
            columnId: 'status',
            label: '全部状态',
            options: [
              { label: '已验证', value: 'VALIDATED' },
              { label: '已发布', value: 'PUBLISHED' },
              { label: '已下架', value: 'RETIRED' }
            ]
          }}
          getRowId={(row) => row.id}
          hasMore={packages.hasNextPage}
          isLoading={packages.isLoading}
          isLoadingMore={packages.isFetchingNextPage}
          onLoadMore={() => void packages.fetchNextPage()}
          onRetry={() => void packages.refetch()}
          searchPlaceholder="搜索技能包或 skillId"
          toolbarAction={canWrite ? (
            <Button variant="primary" size="xs" onClick={() => { upload.reset(); setUploadOpen(true); }}>
              <Upload aria-hidden className="size-3.5" />
              上传技能包
            </Button>
          ) : undefined}
        />
      </div>
      {uploadOpen ? (
        <UploadSkillVersionDialog
          error={upload.error?.message}
          parsed={upload.data}
          saving={upload.isPending}
          onClose={() => {
            setUploadOpen(false);
            upload.reset();
          }}
          onSave={(value) => upload.mutate(value)}
        />
      ) : null}
      {assignmentOpen ? (
        <SkillAssignmentDialog
          error={saveAssignments.error?.message}
          initialPackageId={assignmentPackageId}
          packages={packageRows}
          saving={saveAssignments.isPending}
          onClose={() => setAssignmentOpen(false)}
          onSave={(value) => saveAssignments.mutate(value)}
        />
      ) : null}
      {detailPackage && !retireTarget ? (
        <SkillDetailDialog
          assignmentError={saveAssignments.error?.message}
          assignmentsPending={saveAssignments.isPending}
          canWrite={canWrite}
          memberNames={memberNames}
          skillPackage={detailPackage}
          versionError={changeVersion.error?.message}
          versionPending={changeVersion.isPending}
          onClose={() => setDetailPackageId(undefined)}
          onPublish={(version) => changeVersion.mutate({ action: 'publish', version })}
          onRetire={setRetireTarget}
          onSaveAssignments={(value) => saveAssignments.mutate(value)}
        />
      ) : null}
      {retireTarget ? (
        <RetireSkillVersionDialog
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
