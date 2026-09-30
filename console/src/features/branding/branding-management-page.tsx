/**
 * [INPUT]: 依赖生成的管理端品牌 operation、console 权限事实、TanStack Query、lib/crypto 幂等键与 branding 编辑视图。
 * [OUTPUT]: 提供品牌名称/欢迎语编辑、三个 LOGO 槽位上传与清除、登录弹窗预览、发布、历史 revision 回滚。
 * [POS]: features/branding 的产品品牌工作台；服务端独占位图校验、CAS、revision 与审计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { History, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getAdminBranding,
  listAdminBrandingRevisions,
  publishBranding,
  rollbackBranding,
  uploadBrandingAsset
} from '@/api/generated/sdk.gen';
import type {
  BrandingBrandingAdminResponse,
  BrandingBrandingPublishRequest,
  BrandingBrandingRevision,
  EnterpriseErrorResponse
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { randomUuid } from '@/lib/crypto';
import {
  BrandingPreview,
  BrandingSlotPicker,
  BRANDING_SLOTS,
  draftFromPublished,
  RollbackBrandingDialog,
  type BrandingDraft,
  type BrandingSlot
} from './branding-editors';

const inputClass = 'h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-tint';

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

async function loadBranding() {
  return unwrapData<BrandingBrandingAdminResponse['data']>(await getAdminBranding(), 'ENT_BRANDING_UNAVAILABLE');
}

async function loadRevisions() {
  const result = await listAdminBrandingRevisions({ query: { limit: 50 } });
  const page = unwrapData<{ items: BrandingBrandingRevision[] }>(result, 'ENT_BRANDING_REVISIONS_UNAVAILABLE');
  return page.items;
}

export function publishBody(value: BrandingDraft): BrandingBrandingPublishRequest {
  return {
    name: value.name.trim() || null,
    shortName: value.shortName.trim() || null,
    logoLightAssetId: value.assets.light?.id ?? null,
    logoDarkAssetId: value.assets.dark?.id ?? null,
    logoSquareAssetId: value.assets.square?.id ?? null,
    welcomeHeadline: value.headline.trim() || null,
    welcomeEditionLabel: value.editionLabel.trim() || null
  };
}

export function isBrandingDraftEmpty(value: BrandingDraft): boolean {
  const body = publishBody(value);
  return Object.values(body).every((field) => field === null);
}

function formatDate(value: string | null) {
  if (!value) return '尚未发布';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function BrandingManagementPage() {
  const { bootstrap } = useRouteContext({ from: '/_console' });
  const canWrite = bootstrap.permissions.includes('ent:branding:write');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BrandingDraft>();
  const [seededRevision, setSeededRevision] = useState<number | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const branding = useQuery({ queryKey: ['branding', 'current'], queryFn: loadBranding, staleTime: 15_000 });
  const revisions = useQuery({
    queryKey: ['branding', 'revisions'],
    queryFn: loadRevisions,
    enabled: rollbackOpen,
    staleTime: 0
  });

  // 只在"服务端 revision 与表单来源不同"时重建草稿：本地未发布编辑不会被后台刷新覆盖，
  // 而重新载入按钮通过清空 seededRevision 显式丢弃本地编辑。
  useEffect(() => {
    if (branding.data && branding.data.revision !== seededRevision) {
      setDraft(draftFromPublished(branding.data));
      setSeededRevision(branding.data.revision);
    }
  }, [branding.data, seededRevision]);

  const publishing = useMutation({
    mutationFn: async (value: BrandingDraft) => {
      if (!branding.data) throw new Error('ENT_BRANDING_UNAVAILABLE');
      requireSuccess(await publishBranding({
        headers: { 'If-Match': branding.data.revision },
        body: publishBody(value)
      }), 'ENT_BRANDING_PUBLISH_FAILED');
    },
    onSuccess: async () => {
      // 发布后 revision 变化会驱动 effect 重建草稿，避免出现空表单闪烁。
      await queryClient.invalidateQueries({ queryKey: ['branding'] });
    }
  });
  const uploading = useMutation({
    mutationFn: async ({ file, slot }: { file: File; slot: BrandingSlot }) => {
      const asset = unwrapData<{ id: string; url: string; sha256: string; contentType: string; width: number; height: number; sizeBytes: number }>(
        await uploadBrandingAsset({ body: { asset: file }, headers: { 'Idempotency-Key': randomUuid() } }),
        'ENT_BRANDING_UPLOAD_FAILED'
      );
      return { asset, slot };
    },
    onSuccess: ({ asset, slot }) => {
      setDraft((current) => current ? { ...current, assets: { ...current.assets, [slot]: asset } } : current);
    }
  });
  const rollingBack = useMutation({
    mutationFn: async (targetRevision: number) => {
      if (!branding.data) throw new Error('ENT_BRANDING_UNAVAILABLE');
      requireSuccess(await rollbackBranding({
        headers: { 'If-Match': branding.data.revision },
        body: { targetRevision: String(targetRevision) }
      }), 'ENT_BRANDING_ROLLBACK_FAILED');
    },
    onSuccess: async () => {
      setRollbackOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['branding'] });
    }
  });

  const current = branding.data;
  if (!draft || !current) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-ink-3">
        {branding.error ? errorMessage(branding.error, '品牌配置读取失败') : '正在载入品牌配置...'}
      </div>
    );
  }

  const actionError = publishing.error ?? uploading.error ?? rollingBack.error ?? branding.error;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div>
            <h1 className="m-0 text-[22px] font-semibold leading-tight text-ink">品牌</h1>
            <p className="m-0 mt-1 text-[12.5px] text-ink-3">
              配置企业名称、LOGO 与欢迎语；发布后经免登录公开接口对员工客户端生效，回滚只追加新的 revision。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="xs" onClick={() => { setSeededRevision(null); void branding.refetch(); }}>
              <RefreshCw aria-hidden className="size-3.5" />
              重新载入
            </Button>
            <Button type="button" size="xs" disabled={!canWrite || current.revision === 0} onClick={() => setRollbackOpen(true)}>
              <History aria-hidden className="size-3.5" />
              回滚
            </Button>
            <Button
              type="button"
              variant="primary"
              size="xs"
              disabled={!canWrite || publishing.isPending || isBrandingDraftEmpty(draft)}
              onClick={() => publishing.mutate(draft)}
            >
              <Save aria-hidden className="size-3.5" />
              {publishing.isPending ? '发布中' : '发布'}
            </Button>
          </div>
        </header>

        {!canWrite ? <p className="m-0 text-[12.5px] text-ink-3">当前角色只有读取权限（ent:branding:read），无法发布或回滚。</p> : null}
        {actionError ? <p role="alert" className="m-0 text-[12.5px] text-red">{errorMessage(actionError, '品牌操作失败')}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4 rounded-xl border border-line bg-canvas p-4">
            <h2 className="m-0 text-[14px] font-semibold text-ink">品牌内容</h2>
            <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
              企业名称
              <input className={inputClass} disabled={!canWrite} maxLength={120} placeholder="例如 DeepSeek Harness 企业版" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
              企业简称
              <input className={inputClass} disabled={!canWrite} maxLength={60} placeholder="例如 DSH 企业版" value={draft.shortName} onChange={(event) => setDraft({ ...draft, shortName: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
              欢迎语
              <input className={inputClass} disabled={!canWrite} maxLength={200} placeholder="例如 探索未至之境" value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} />
            </label>
            <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
              版本标识
              <input className={inputClass} disabled={!canWrite} maxLength={60} placeholder="例如 预览版" value={draft.editionLabel} onChange={(event) => setDraft({ ...draft, editionLabel: event.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {BRANDING_SLOTS.map((slot) => (
                <BrandingSlotPicker
                  key={slot}
                  asset={draft.assets[slot]}
                  busy={uploading.isPending && uploading.variables?.slot === slot}
                  disabled={!canWrite}
                  slot={slot}
                  onClear={() => setDraft({ ...draft, assets: { ...draft.assets, [slot]: null } })}
                  onUpload={(file, target) => { uploading.reset(); uploading.mutate({ file, slot: target }); }}
                />
              ))}
            </div>
            <p className="m-0 text-[12px] text-ink-3">只接受 PNG/JPEG/WebP 位图，单文件不超过 512 KiB；上传的资产在发布前只对管理员可见。</p>
          </section>

          <aside className="grid content-start gap-4">
            <BrandingPreview draft={draft} />
            <div className="grid gap-2 rounded-xl border border-line bg-canvas p-4 text-[12.5px] text-ink-2">
              <h2 className="m-0 text-[14px] font-semibold text-ink">当前发布</h2>
              <div className="flex justify-between"><span className="text-ink-3">revision</span><span className="font-mono text-ink">{current.revision}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">发布时间</span><span className="text-ink">{formatDate(current.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">最后操作人</span><span className="font-mono text-ink">{current.updatedBy ?? '-'}</span></div>
              <p className="m-0 mt-1 text-[12px] text-ink-3">公开接口：GET /enterprise/api/v1/branding（免登录、ETag 缓存、只回白名单字段）。</p>
            </div>
          </aside>
        </div>
      </div>
      {rollbackOpen ? (
        <RollbackBrandingDialog
          currentRevision={current.revision}
          error={rollingBack.error ? errorMessage(rollingBack.error, '品牌回滚失败') : undefined}
          revisions={revisions.data ?? []}
          saving={rollingBack.isPending}
          onClose={() => setRollbackOpen(false)}
          onConfirm={(targetRevision) => rollingBack.mutate(targetRevision)}
        />
      ) : null}
    </div>
  );
}
