/**
 * [INPUT]: 依赖 React、ProductDialog、生成的管理端品牌 DTO 与浏览器原生文件控件。
 * [OUTPUT]: 提供 LOGO 槽位上传/清除控件、未发布品牌预览卡片与历史 revision 回滚确认对话框。
 * [POS]: features/branding 的编辑视图层，只收集产品语义并展示服务端事实，不直接发起请求。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ImageOff, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { BrandingBrandingAdminAsset, BrandingBrandingRevision } from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { ProductDialog } from '@/components/product/Dialog';
import { fieldClass } from '@/lib/styles';

export const BRANDING_SLOTS = ['light', 'dark', 'square'] as const;
export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

export const SLOT_LABELS: Record<BrandingSlot, string> = {
  light: '亮色 LOGO',
  dark: '暗色 LOGO',
  square: '方形图标'
};

const MAX_ASSET_BYTES = 512 * 1024;
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

export type BrandingDraft = {
  name: string;
  shortName: string;
  headline: string;
  editionLabel: string;
  assets: Record<BrandingSlot, BrandingBrandingAdminAsset | null>;
};

export function draftFromPublished(value: {
  name: string | null;
  shortName: string | null;
  logo: { light: BrandingBrandingAdminAsset | null; dark: BrandingBrandingAdminAsset | null; square: BrandingBrandingAdminAsset | null };
  welcome: { headline: string | null; editionLabel: string | null };
}): BrandingDraft {
  return {
    name: value.name ?? '',
    shortName: value.shortName ?? '',
    headline: value.welcome.headline ?? '',
    editionLabel: value.welcome.editionLabel ?? '',
    assets: { light: value.logo.light, dark: value.logo.dark, square: value.logo.square }
  };
}

export function BrandingSlotPicker({
  asset,
  busy,
  disabled,
  slot,
  onClear,
  onUpload
}: {
  asset: BrandingBrandingAdminAsset | null;
  busy: boolean;
  disabled: boolean;
  slot: BrandingSlot;
  onClear: () => void;
  onUpload: (file: File, slot: BrandingSlot) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string>();

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
      setValidationError('只支持 PNG/JPEG/WebP 位图');
      return;
    }
    if (file.size > MAX_ASSET_BYTES) {
      setValidationError('单个 LOGO 不能超过 512 KiB');
      return;
    }
    setValidationError(undefined);
    onUpload(file, slot);
  };

  return (
    <div className="grid gap-2 rounded-xl border border-line bg-inset/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{SLOT_LABELS[slot]}</span>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="xs" variant="quiet" disabled={disabled || busy} onClick={() => input.current?.click()}>
            <Upload aria-hidden className="size-3.5" />
            {busy ? '上传中' : asset ? '替换' : '上传'}
          </Button>
          {asset ? (
            <Button type="button" size="xs" variant="quiet" className="text-red" disabled={disabled || busy} aria-label={`清除${SLOT_LABELS[slot]}`} onClick={onClear}>
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-canvas">
        {asset ? (
          <img alt={SLOT_LABELS[slot]} className="max-h-16 max-w-full object-contain" src={asset.url} />
        ) : (
          <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <ImageOff aria-hidden className="size-3.5" />
            未设置
          </span>
        )}
      </div>
      {asset ? (
        <p className="m-0 truncate font-mono text-[11px] text-ink-3" title={asset.sha256}>
          {asset.contentType} · {asset.width}×{asset.height} · {Math.round(asset.sizeBytes / 1024)} KiB
        </p>
      ) : null}
      <input
        ref={input}
        accept={ACCEPTED_TYPES}
        aria-label={`选择${SLOT_LABELS[slot]}`}
        className="hidden"
        type="file"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {validationError ? <p role="alert" className="m-0 text-[12px] text-red">{validationError}</p> : null}
    </div>
  );
}

export function BrandingPreview({ draft }: { draft: BrandingDraft }) {
  const logo = draft.assets.light ?? draft.assets.square ?? draft.assets.dark;
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-canvas p-4">
      <span className="text-[12.5px] font-medium text-ink-2">登录弹窗预览</span>
      <div className="grid justify-items-center gap-3 rounded-xl border border-line bg-page px-5 py-7 text-center">
        {logo ? (
          <img alt="品牌 LOGO" className="max-h-12 max-w-[180px] object-contain" src={logo.url} />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-inset text-ink-3">
            <ImageOff aria-hidden className="size-5" />
          </span>
        )}
        <div className="grid gap-1">
          <strong className="text-[15px] font-semibold text-ink">{draft.name.trim() || '未命名企业'}</strong>
          <span className="text-[12.5px] text-ink-3">{draft.headline.trim() || '未设置欢迎语'}</span>
        </div>
        {draft.editionLabel.trim() ? (
          <span className="rounded-full border border-line bg-inset px-2.5 py-0.5 text-[11.5px] text-ink-2">{draft.editionLabel.trim()}</span>
        ) : null}
      </div>
      <p className="m-0 text-[12px] text-ink-3">预览只反映当前表单；未发布前员工端仍读到上一个 revision。</p>
    </div>
  );
}

export function RollbackBrandingDialog({
  currentRevision,
  error,
  revisions,
  saving,
  onClose,
  onConfirm
}: {
  currentRevision: number;
  error?: string;
  revisions: BrandingBrandingRevision[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (targetRevision: number) => void;
}) {
  const candidates = revisions.filter((revision) => revision.revision < currentRevision);
  const [target, setTarget] = useState(candidates[0]?.revision ?? 0);

  return (
    <ProductDialog title="回滚品牌" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <p className="m-0 text-[12.5px] text-ink-3">回滚会把选定历史 revision 的内容作为新 revision 重新发布，历史记录不会被改写。</p>
        {candidates.length === 0 ? (
          <p className="m-0 text-[12.5px] text-ink-3">当前没有更早的 revision 可回滚。</p>
        ) : (
          <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
            目标 revision
            <select
              className={fieldClass}
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
            >
              {candidates.map((revision) => (
                <option key={revision.id} value={revision.revision}>
                  revision {revision.revision} · {revision.name ?? '未命名'} · {new Date(revision.publishedAt).toLocaleString('zh-CN')}
                </option>
              ))}
            </select>
          </label>
        )}
        {error ? <p role="alert" className="m-0 text-[12.5px] text-red">{error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving || candidates.length === 0} onClick={() => onConfirm(target)}>
          {saving ? '回滚中' : '确认回滚'}
        </Button>
      </footer>
    </ProductDialog>
  );
}
