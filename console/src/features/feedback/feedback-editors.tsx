/**
 * [INPUT]: 依赖 React、ProductDialog、Button/SegmentedControl/StatusPill 原子、反馈 DTO 与产品视觉 token。
 * [OUTPUT]: 提供反馈状态/类型文案、状态色板、冻结链路下一步集合与只读详情 + 处置对话框。
 * [POS]: features/feedback 的展示与写入表单层，只收集目标状态与备注，不持有 mutation、不读 artifact 路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FeedbackDetail, FeedbackStatus, FeedbackType } from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { SegmentedControl } from '@/components/atoms/SegmentedControl';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ProductDialog } from '@/components/product/Dialog';
import { formatBytes } from '@/lib/format';

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: '待分诊',
  triaged: '已分诊',
  resolved: '已解决',
  ignored: '已忽略'
};

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  issue: '问题',
  suggestion: '建议'
};

export const FEEDBACK_STATUS_TONES: Record<FeedbackStatus, 'orange' | 'accent' | 'green' | 'neutral'> = {
  new: 'orange',
  triaged: 'accent',
  resolved: 'green',
  ignored: 'neutral'
};

/**
 * 与服务端冻结链路同构的下一步集合：new→triaged，triaged→resolved|ignored，终态没有动作。
 * 控制台只隐藏不可能的按钮，最终裁决仍在服务端状态机。
 */
export function nextStatuses(status: FeedbackStatus): FeedbackStatus[] {
  if (status === 'new') return ['triaged'];
  if (status === 'triaged') return ['resolved', 'ignored'];
  return [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const DIAGNOSTIC_FIELDS: ReadonlyArray<{ key: keyof FeedbackDetail['diagnostics']; label: string }> = [
  { key: 'pluginVersion', label: '插件版本' },
  { key: 'hostVersion', label: '宿主版本' },
  { key: 'os', label: '操作系统' },
  { key: 'installationId', label: 'installationId' },
  { key: 'lastErrorCode', label: '最近错误码' }
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-[12.5px]">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 break-all text-right text-ink">{children}</span>
    </div>
  );
}

export function FeedbackDetailDialog({
  canWrite,
  detail,
  error,
  loading,
  note,
  saving,
  onClose,
  onNoteChange,
  onSave
}: {
  canWrite: boolean;
  detail?: FeedbackDetail;
  error?: string;
  loading: boolean;
  note: string;
  saving: boolean;
  onClose: () => void;
  onNoteChange: (value: string) => void;
  onSave: (status: FeedbackStatus, note: string, revision: number) => void;
}) {
  const targets = detail ? nextStatuses(detail.status) : [];
  const [target, setTarget] = useState<FeedbackStatus | undefined>(targets[0]);

  useEffect(() => {
    setTarget(detail ? nextStatuses(detail.status)[0] : undefined);
  }, [detail?.id, detail?.status]);

  return (
    <ProductDialog title="反馈详情" className="max-w-[720px]" onClose={onClose}>
      {loading || !detail ? (
        <p className="m-0 px-5 py-6 text-[13px] text-ink-3">{loading ? '正在载入反馈详情...' : '没有可展示的反馈。'}</p>
      ) : (
        <div className="grid gap-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={FEEDBACK_STATUS_TONES[detail.status]}>{FEEDBACK_STATUS_LABELS[detail.status]}</StatusPill>
            <span className="text-[12.5px] text-ink-3">{FEEDBACK_TYPE_LABELS[detail.type]}</span>
            <span className="font-mono text-[11px] text-ink-3">{detail.id}</span>
          </div>

          <p className="m-0 whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink">
            {detail.description}
          </p>

          <div className="grid gap-1.5 rounded-lg border border-line bg-canvas p-3">
            <Field label="提交员工">{detail.submitterId}</Field>
            <Field label="联系方式">{detail.contact ?? '-'}</Field>
            <Field label="发生时间">{formatDate(detail.occurredAt)}</Field>
            <Field label="提交时间">{formatDate(detail.createdAt)}</Field>
            <Field label="revision">{detail.revision}</Field>
          </div>

          <section className="grid gap-1.5 rounded-lg border border-line bg-canvas p-3">
            <h3 className="m-0 text-[13px] font-semibold text-ink">客户端诊断</h3>
            {DIAGNOSTIC_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>{detail.diagnostics[field.key] ?? '-'}</Field>
            ))}
          </section>

          <section className="grid gap-2 rounded-lg border border-line bg-canvas p-3">
            <h3 className="m-0 text-[13px] font-semibold text-ink">附件（{detail.attachments.length}）</h3>
            {detail.attachments.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-3">本次反馈没有附件。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.attachments.map((attachment) => (
                  <figure key={attachment.id} className="m-0 grid gap-1.5">
                    <img
                      alt={`附件 ${attachment.seq}`}
                      className="max-h-[220px] w-full rounded-md border border-line object-contain"
                      src={attachment.url}
                    />
                    <figcaption className="text-[11.5px] text-ink-3">
                      #{attachment.seq} {attachment.extension.toUpperCase()} · {attachment.width}×{attachment.height} · {formatBytes(attachment.sizeBytes)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-2 rounded-lg border border-line bg-canvas p-3">
            <h3 className="m-0 text-[13px] font-semibold text-ink">处置</h3>
            {detail.statusNote ? <Field label="最近备注">{detail.statusNote}</Field> : null}
            {detail.statusChangedAt ? <Field label="上次流转">{formatDate(detail.statusChangedAt)}</Field> : null}
            {!canWrite ? (
              <p className="m-0 text-[12.5px] text-ink-3">当前角色只有读取权限（ent:feedback:read），无法流转状态。</p>
            ) : targets.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-3">该反馈已处于终态（{FEEDBACK_STATUS_LABELS[detail.status]}），不再流转。</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    options={targets.map((value) => FEEDBACK_STATUS_LABELS[value])}
                    value={FEEDBACK_STATUS_LABELS[target ?? targets[0]!]}
                    onChange={(label) => {
                      const matched = targets.find((value) => FEEDBACK_STATUS_LABELS[value] === label);
                      if (matched) setTarget(matched);
                    }}
                  />
                  <ArrowRight aria-hidden className="size-4 text-ink-3" />
                  <span className="text-[12.5px] text-ink-2">备注可选，最多 500 字</span>
                </div>
                <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
                  处置备注
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-tint"
                    maxLength={500}
                    placeholder="例如：已确认复现，下个迭代修复"
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                  />
                </label>
                {error ? <p role="alert" className="m-0 text-[12.5px] text-red">{error}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" size="xs" onClick={onClose}>取消</Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    disabled={saving || target === undefined}
                    onClick={() => {
                      if (target !== undefined) onSave(target, note, detail.revision);
                    }}
                  >
                    {saving ? '提交中' : `确认标记为${FEEDBACK_STATUS_LABELS[target ?? targets[0]!]}`}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </ProductDialog>
  );
}
