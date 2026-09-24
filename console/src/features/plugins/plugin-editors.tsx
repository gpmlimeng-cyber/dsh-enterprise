/**
 * [INPUT]: 依赖 React、共享 MemberSelect、ProductDialog、插件 DTO 与浏览器原生表单控件。
 * [OUTPUT]: 提供插件 tgz/tar.gz/zip 上传（服务端嗅探魔数并归一化为标准 npm tgz）、ALL/USER 企业可见范围编辑（原样重发不可编辑的 DEPT 事实）和版本退休确认对话框；发布不强制安装。
 * [POS]: features/plugins 的写入表单层，只收集产品语义，不解析 tgz、不签名也不持有 mutation。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type {
  PluginAssignmentWrite,
  PluginCompatibility,
  PluginOperatingSystem,
  PluginPackage,
  PluginSubjectType,
  PluginVersion
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { ProductDialog } from '@/components/product/Dialog';
import { MemberSelect } from '@/features/member-select';

/**
 * 上传表单的可编辑初值，不是兼容性白名单：服务端 PluginCompatibility 只校验
 * `^[0-9a-f]{40}$` 等 commit 形态，真实兼容裁决按 Harness 自身 caret peer 规则进行。
 * 第一行是当前官方桌面端插件基线；其余行保留已映射的旧 Harness commit，避免新上传漏掉仍在运行的客户端。
 * 控制台没有任何协议字段可读取服务端受支持集合，因此这里只是运维可改的种子值。
 */
const DEFAULT_HARNESS_COMMITS = [
  '46a7f68b0922371ce7144b668b90e377d8e799f4',
  'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  'a66e4702047846cdaa10c66c9d3df3951f5ea70d',
  'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e',
].join('\n');
const HARNESS_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const MAX_HARNESS_COMMITS = 20;
const MAX_ASSIGNMENT_ITEMS = 200;
const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
/**
 * 控制台只做扩展名门禁，真实格式由服务端嗅探魔数裁决并归一化为标准 npm tgz。
 * `.tar.gz` 作为整体后缀独立比对，不能退化为泛 `.gz` 匹配。
 */
const ACCEPTED_ARTIFACT_EXTENSIONS: ReadonlyArray<string> = ['.tgz', '.tar.gz', '.zip'];

function isAcceptedArtifactName(name: string): boolean {
  const lowerCaseName = name.toLowerCase();
  return ACCEPTED_ARTIFACT_EXTENSIONS.some((extension) => lowerCaseName.endsWith(extension));
}
const OPERATING_SYSTEMS: ReadonlyArray<{ label: string; value: PluginOperatingSystem }> = [
  { label: 'macOS', value: 'darwin' },
  { label: 'Linux', value: 'linux' },
  { label: 'Windows', value: 'win32' }
];
const inputClass = 'h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-tint';

export type PluginUploadValue = {
  artifact: File;
  compatibility: PluginCompatibility;
};

type ProductAssignment = Omit<PluginAssignmentWrite, 'subjectType'> & {
  subjectType: 'ALL' | 'USER';
};

/** ALL/USER 是控制台可编辑的可见范围；DEPT 不在此界面呈现，只能原样透传。 */
type EditableSubjectType = ProductAssignment['subjectType'];

const EDITABLE_SUBJECT_TYPES: ReadonlyArray<EditableSubjectType> = ['ALL', 'USER'];

function isEditableSubjectType(value: PluginSubjectType): value is EditableSubjectType {
  return (EDITABLE_SUBJECT_TYPES as ReadonlyArray<PluginSubjectType>).includes(value);
}

function toWrite(assignment: PluginAssignmentWrite): PluginAssignmentWrite {
  return {
    pluginVersionId: assignment.pluginVersionId,
    subjectType: assignment.subjectType,
    subjectId: assignment.subjectId,
    desiredState: assignment.desiredState,
    required: false
  };
}

function editableAssignments(pluginPackage: PluginPackage): ProductAssignment[] {
  return pluginPackage.assignments.flatMap((assignment) => (
    isEditableSubjectType(assignment.subjectType)
      // 收窄发生在属性访问路径上，因此 subjectType 在此分支已知为 ALL|USER。
      ? [{ ...toWrite(assignment), subjectType: assignment.subjectType }]
      : []
  ));
}

/**
 * 保存是服务端全量替换（PluginCatalogService.replaceAssignments 先无范围删除再插入）。
 * 控制台不呈现 DEPT 可见范围，因此必须把加载到的 DEPT 事实原样重发，
 * 否则一次“什么都没改”的保存会永久删除控制台从未显示的分配。
 */
function preservedAssignments(pluginPackage: PluginPackage): PluginAssignmentWrite[] {
  return pluginPackage.assignments
    .filter((assignment) => !isEditableSubjectType(assignment.subjectType))
    .map((assignment) => toWrite(assignment));
}

export type PluginAssignmentValue = {
  /**
   * 完整替换载荷（服务端 replaceAssignments 是无范围全量替换）：
   * 可编辑的 ALL/USER 项 + 界面未呈现、必须原样重发的 DEPT 事实。
   * 此处已是终态，调用方不得再自行拼装，否则会重新打开静默删除的缺口。
   */
  items: PluginAssignmentWrite[];
  packageId: string;
  revision: number;
};

export function parseHarnessCommits(value: string) {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

export function UploadPluginVersionDialog({
  error,
  onClose,
  onSave,
  saving
}: {
  error?: string;
  onClose: () => void;
  onSave: (value: PluginUploadValue) => void;
  saving: boolean;
}) {
  const [artifact, setArtifact] = useState<File>();
  const [harnessCommits, setHarnessCommits] = useState(DEFAULT_HARNESS_COMMITS);
  const [enterpriseBundleRange, setEnterpriseBundleRange] = useState('>=0.1.0 <0.2.0');
  const [operatingSystems, setOperatingSystems] = useState<PluginOperatingSystem[]>(['darwin', 'linux', 'win32']);
  const [validationError, setValidationError] = useState<string>();

  const submit = () => {
    if (!artifact || !isAcceptedArtifactName(artifact.name)) {
      setValidationError('请选择 .tgz、.tar.gz 或 .zip 插件包');
      return;
    }
    if (artifact.size > MAX_ARTIFACT_BYTES) {
      setValidationError('插件包不能超过 50 MiB');
      return;
    }
    const commits = parseHarnessCommits(harnessCommits);
    if (commits.length === 0 || commits.length > 20 || commits.some((commit) => !/^[0-9a-f]{40}$/.test(commit))) {
      setValidationError('Harness commit 必须是 1-20 个完整小写 commit');
      return;
    }
    if (!enterpriseBundleRange.trim()) {
      setValidationError('Bundle 版本范围不能为空');
      return;
    }
    if (operatingSystems.length === 0) {
      setValidationError('至少选择一个操作系统');
      return;
    }
    setValidationError(undefined);
    onSave({
      artifact,
      compatibility: {
        harnessCommits: commits,
        enterpriseBundleRange: enterpriseBundleRange.trim(),
        operatingSystems
      }
    });
  };

  return (
    <ProductDialog title="上传插件版本" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          插件包
          <input
            type="file"
            accept=".tgz,.tar.gz,.zip,application/gzip,application/zip,application/x-zip-compressed"
            className="block w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] text-ink file:mr-3 file:rounded-md file:border-0 file:bg-inset file:px-2.5 file:py-1 file:text-[12px] file:text-ink-2"
            onChange={(event) => setArtifact(event.target.files?.[0])}
          />
        </label>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          Harness commits
          <textarea
            className={`${inputClass} min-h-20 resize-y py-2 font-mono text-[12px]`}
            value={harnessCommits}
            onChange={(event) => setHarnessCommits(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          Bundle 版本范围
          <input className={inputClass} value={enterpriseBundleRange} onChange={(event) => setEnterpriseBundleRange(event.target.value)} />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-[12.5px] font-medium text-ink-2">操作系统</legend>
          <div className="flex flex-wrap gap-4">
            {OPERATING_SYSTEMS.map((system) => (
              <label key={system.value} className="flex items-center gap-2 text-[13px] text-ink-2">
                <input
                  type="checkbox"
                  checked={operatingSystems.includes(system.value)}
                  onChange={(event) => setOperatingSystems((current) => event.target.checked
                    ? [...current, system.value]
                    : current.filter((value) => value !== system.value))}
                />
                {system.label}
              </label>
            ))}
          </div>
        </fieldset>
        {validationError || error ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={submit}>{saving ? '上传中' : '上传并验证'}</Button>
      </footer>
    </ProductDialog>
  );
}

export function PluginAssignmentDialog({
  error,
  onClose,
  onSave,
  packages,
  saving
}: {
  error?: string;
  onClose: () => void;
  onSave: (value: PluginAssignmentValue) => void;
  packages: ReadonlyArray<PluginPackage>;
  saving: boolean;
}) {
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');
  const [items, setItems] = useState<ProductAssignment[]>(packages[0] ? editableAssignments(packages[0]) : []);
  const [validationError, setValidationError] = useState<string>();
  const pluginPackage = packages.find((item) => item.id === packageId);
  const publishedVersions = pluginPackage?.versions.filter((version) => version.status === 'PUBLISHED') ?? [];

  const selectPackage = (nextPackageId: string) => {
    const nextPackage = packages.find((item) => item.id === nextPackageId);
    setPackageId(nextPackageId);
    setItems(nextPackage ? editableAssignments(nextPackage) : []);
    setValidationError(undefined);
  };
  const updateItem = (index: number, patch: Partial<ProductAssignment>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const addItem = () => {
    const version = publishedVersions[0];
    if (!version) {
      setValidationError('请先发布一个插件版本');
      return;
    }
    setItems((current) => [...current, {
      pluginVersionId: version.id,
      subjectType: current.some((item) => item.subjectType === 'ALL') ? 'USER' : 'ALL',
      subjectId: null,
      desiredState: 'INSTALLED',
      required: false
    }]);
    setValidationError(undefined);
  };
  const submit = () => {
    if (!pluginPackage) return;
    if (items.some((item) => !publishedVersions.some((version) => version.id === item.pluginVersionId))) {
      setValidationError('每条分配必须选择已发布版本');
      return;
    }
    if (items.some((item) => item.subjectType === 'USER' && !item.subjectId)) {
      setValidationError('请选择成员');
      return;
    }
    const subjects = items.map((item) => `${item.subjectType}:${item.subjectId ?? ''}`);
    if (new Set(subjects).size !== subjects.length) {
      setValidationError('同一分配对象只能存在一条规则');
      return;
    }
    setValidationError(undefined);
    onSave({
      packageId: pluginPackage.id,
      revision: pluginPackage.revision,
      // 可编辑项在前，原样保留的不可编辑事实在后；服务端按全量替换消费，
      // 因此这里必须一次性交齐，避免任何“只提交界面所见”的路径重新引入静默删除。
      items: [
        ...items.map((item) => ({
          ...item,
          subjectId: item.subjectType === 'ALL' ? null : item.subjectId,
          required: false
        })),
        ...preservedAssignments(pluginPackage)
      ]
    });
  };

  return (
    <ProductDialog title="配置可见范围" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          插件
          <select className={inputClass} value={packageId} onChange={(event) => selectPackage(event.target.value)}>
            {packages.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        </label>
        <div className="grid gap-3">
          {items.map((item, index) => (
            <div key={`${item.subjectType}:${item.subjectId ?? 'all'}:${index}`} className="grid gap-3 border-b border-line pb-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
                版本
                <select className={inputClass} value={item.pluginVersionId} onChange={(event) => updateItem(index, { pluginVersionId: event.target.value })}>
                  {pluginPackage?.versions.map((version) => (
                    <option key={version.id} value={version.id} disabled={version.status !== 'PUBLISHED'}>
                      {version.version}{version.status !== 'PUBLISHED' ? ' - 未发布' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
                可见成员
                <select
                  className={inputClass}
                  value={item.subjectType}
                  onChange={(event) => updateItem(index, {
                    subjectType: event.target.value as ProductAssignment['subjectType'],
                    subjectId: null
                  })}
                >
                  <option value="ALL">所有成员</option>
                  <option value="USER">指定成员</option>
                </select>
              </label>
              {item.subjectType === 'USER' ? (
                <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
                  成员
                  <MemberSelect value={item.subjectId ?? ''} onValueChange={(subjectId) => updateItem(index, { subjectId })} />
                </label>
              ) : <div />}
              <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
                可用状态
                <select
                  className={inputClass}
                  value={item.desiredState}
                  onChange={(event) => {
                    const desiredState = event.target.value as ProductAssignment['desiredState'];
                    updateItem(index, { desiredState, ...(desiredState === 'ABSENT' ? { required: false } : {}) });
                  }}
                >
                  <option value="INSTALLED">可见，用户自主安装</option>
                  <option value="ABSENT">撤回并移除已安装插件</option>
                </select>
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="quiet" size="xs" className="size-8 rounded-md p-0 text-red" aria-label={`删除分配 ${index + 1}`} title="删除" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 aria-hidden className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" size="sm" disabled={!pluginPackage || items.length >= 200} onClick={addItem}>
            <Plus aria-hidden className="size-3.5" />
            添加范围
          </Button>
        </div>
        {validationError || error ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving || !pluginPackage} onClick={submit}>{saving ? '保存中' : '保存范围'}</Button>
      </footer>
    </ProductDialog>
  );
}

export function RetirePluginVersionDialog({
  error,
  onClose,
  onConfirm,
  saving,
  version
}: {
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  version: PluginVersion;
}) {
  return (
    <ProductDialog title="退休插件版本" onClose={onClose}>
      <div className="grid gap-3 p-5 text-[13px] text-ink-2">
        <p className="m-0">确认退休 <strong className="text-ink">{version.packageName}@{version.version}</strong>？</p>
        {error ? <p role="alert" className="m-0 text-[12.5px] text-red">{error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={onConfirm}>{saving ? '处理中' : '确认退休'}</Button>
      </footer>
    </ProductDialog>
  );
}
