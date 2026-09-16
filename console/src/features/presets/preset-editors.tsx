/**
 * [INPUT]: 依赖 React、共享 MemberSelect、ProductDialog、配方 DTO 与浏览器原生表单控件。
 * [OUTPUT]: 提供 .dshpreset 上传、ALL/USER 可见范围原子替换和版本退休确认对话框。
 * [POS]: features/presets 的写入表单层，只收集产品语义，不解析 ZIP 也不持有 mutation。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type {
  PresetPresetAssignmentSpec,
  PresetPresetPackage,
  PresetPresetUploadMetadata,
  PresetPresetVersion
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { ProductDialog } from '@/components/product/Dialog';
import { MemberSelect } from '@/features/member-select';

const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
const inputClass = 'h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-tint';

export type PresetUploadValue = {
  artifact: File;
  metadata?: PresetPresetUploadMetadata;
};

export type PresetAssignmentValue = {
  assignments: PresetPresetAssignmentSpec[];
  packageId: string;
  revision: number;
};

function editableAssignments(presetPackage: PresetPresetPackage): PresetPresetAssignmentSpec[] {
  return presetPackage.assignments.map((assignment) => ({
    subjectType: assignment.subjectType,
    subjectId: assignment.subjectId
  }));
}

export function UploadPresetVersionDialog({
  error,
  onClose,
  onSave,
  saving
}: {
  error?: string;
  onClose: () => void;
  onSave: (value: PresetUploadValue) => void;
  saving: boolean;
}) {
  const [artifact, setArtifact] = useState<File>();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string>();

  const submit = () => {
    if (!artifact || !artifact.name.endsWith('.dshpreset')) {
      setValidationError('请选择 .dshpreset 配方包');
      return;
    }
    if (artifact.size > MAX_ARTIFACT_BYTES) {
      setValidationError('配方包不能超过 50 MiB');
      return;
    }
    const metadata: PresetPresetUploadMetadata = {};
    if (displayName.trim()) metadata.displayName = displayName.trim();
    if (description.trim()) metadata.description = description.trim();
    setValidationError(undefined);
    onSave({ artifact, ...(Object.keys(metadata).length ? { metadata } : {}) });
  };

  return (
    <ProductDialog title="上传企业配方" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <p className="m-0 text-[12.5px] text-ink-3">服务端校验 manifest.json、preset/agent.cordis.yml 与路径安全后写入目录。</p>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          配方包
          <input
            type="file"
            accept=".dshpreset,application/vnd.dsh.preset+zip,application/zip"
            className="block w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] text-ink file:mr-3 file:rounded-md file:border-0 file:bg-inset file:px-2.5 file:py-1 file:text-[12px] file:text-ink-2"
            onChange={(event) => setArtifact(event.target.files?.[0])}
          />
        </label>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          显示名称（可选，覆盖 manifest）
          <input className={inputClass} value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          描述（可选，覆盖 manifest）
          <textarea
            className={`${inputClass} min-h-20 resize-y py-2`}
            value={description}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {validationError || error ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={submit}>{saving ? '上传中' : '上传并验证'}</Button>
      </footer>
    </ProductDialog>
  );
}

export function PresetAssignmentDialog({
  error,
  packages,
  saving,
  onClose,
  onSave
}: {
  error?: string;
  packages: PresetPresetPackage[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: PresetAssignmentValue) => void;
}) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');
  const selected = packages.find((item) => item.id === packageId);
  const initial = packages[0] ? editableAssignments(packages[0]) : [];
  const [allVisible, setAllVisible] = useState(() => initial.some((item) => item.subjectType === 'ALL'));
  const [users, setUsers] = useState<string[]>(() => initial.filter((item) => item.subjectType === 'USER').map((item) => item.subjectId ?? ''));
  const [validationError, setValidationError] = useState<string>();

  const selectPackage = (value: string) => {
    setPackageId(value);
    const next = packages.find((item) => item.id === value);
    const items = next ? editableAssignments(next) : [];
    setAllVisible(items.some((item) => item.subjectType === 'ALL'));
    setUsers(items.filter((item) => item.subjectType === 'USER').map((item) => item.subjectId ?? ''));
    setValidationError(undefined);
  };

  const submit = () => {
    if (!selected) return;
    const assignments: PresetPresetAssignmentSpec[] = [];
    if (allVisible) assignments.push({ subjectType: 'ALL' });
    for (const userId of users) {
      if (!userId) {
        setValidationError('请选择成员');
        return;
      }
      assignments.push({ subjectType: 'USER', subjectId: userId });
    }
    setValidationError(undefined);
    onSave({ assignments, packageId: selected.id, revision: selected.revision });
  };

  return (
    <ProductDialog title="配置配方可见范围" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <p className="m-0 text-[12.5px] text-ink-3">保存时全量替换该配方的 ALL/USER 可见范围；上传与发布不会自动对员工可见。</p>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          配方
          <select className={inputClass} value={packageId} onChange={(event) => selectPackage(event.target.value)}>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}（{item.presetId}）</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={allVisible} onChange={(event) => setAllVisible(event.target.checked)} />
          对所有成员可见
        </label>
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink-2">指定成员</span>
            <Button type="button" size="xs" onClick={() => setUsers((items) => [...items, ''])}>
              <Plus aria-hidden className="size-3.5" />
              添加
            </Button>
          </div>
          {users.map((userId, index) => (
            <div key={`${index}-${userId}`} className="flex items-end gap-2">
              <label className="grid min-w-0 flex-1 gap-1.5 text-[12.5px] font-medium text-ink-2">
                成员
                <MemberSelect
                  value={userId}
                  onValueChange={(value) => setUsers((items) => items.map((item, itemIndex) => itemIndex === index ? value : item))}
                />
              </label>
              <Button
                type="button"
                variant="quiet"
                size="xs"
                className="size-8 rounded-md p-0 text-red"
                aria-label={`删除成员 ${index + 1}`}
                onClick={() => setUsers((items) => items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {validationError || error ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving || !selected} onClick={submit}>{saving ? '保存中' : '保存范围'}</Button>
      </footer>
    </ProductDialog>
  );
}

export function RetirePresetVersionDialog({
  error,
  saving,
  version,
  onClose,
  onConfirm
}: {
  error?: string;
  saving: boolean;
  version: PresetPresetVersion;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProductDialog title="退休配方版本" onClose={onClose}>
      <div className="grid gap-3 p-5 text-[13px] text-ink-2">
        <p className="m-0">确认退休 <strong className="text-ink">{version.presetId}@{version.sourceDshVersion}</strong>？</p>
        <p className="m-0">退休后停止新的授权下载；已导入本机的配方不会远程撤回。</p>
        {error ? <p role="alert" className="m-0 text-[12.5px] text-red">{error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={onConfirm}>{saving ? '处理中' : '确认退休'}</Button>
      </footer>
    </ProductDialog>
  );
}
