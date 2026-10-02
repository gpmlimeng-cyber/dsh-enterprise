/**
 * [INPUT]: 依赖 React、ProductDialog/Button/StatusPill 原子、共享 MemberSelect、生成技能 DTO 与浏览器原生表单控件。
 * [OUTPUT]: 提供技能版本状态文案/色板、版本时间线/最新版本/可见范围摘要与 draft→spec 校验、安全提示与 SKILL.md 条目预览，以及 .dshskill 上传确认、可见范围编辑（独立对话框与详情内联共用同一份字段与校验）、详情和下架确认对话框。
 * [POS]: features/skills 的展示与写入表单层，只收集产品语义，不解析 ZIP、不持有 mutation；manifest 与条目预览一律来自服务端解析结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Archive, CloudUpload, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type {
  SkillSkillAssignment,
  SkillSkillAssignmentSpec,
  SkillSkillEntry,
  SkillSkillPackage,
  SkillSkillUploadMetadata,
  SkillSkillVersion,
  SkillSkillVersionStatus
} from '@/api/generated/types.gen';
import { Button } from '@/components/atoms/Button';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ProductDialog } from '@/components/product/Dialog';
import { MemberSelect } from '@/features/member-select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/format';
import { fieldClass } from '@/lib/styles';

const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
/**
 * 控制台只做扩展名门禁；真实格式、frontmatter 与路径安全由服务端验包裁决。
 * `application/vnd.dsh.skill+zip` 是 skill.yaml 下载响应已声明的同一 MIME，不另造类型。
 */
const SKILL_ARTIFACT_EXTENSION = '.dshskill';
const inputClass = cn(fieldClass, 'placeholder:text-ink-3');

export const SKILL_VERSION_STATUS: Record<SkillSkillVersionStatus, { label: string; tone: 'accent' | 'green' | 'neutral' }> = {
  VALIDATED: { label: '已验证', tone: 'accent' },
  PUBLISHED: { label: '已发布', tone: 'green' },
  RETIRED: { label: '已下架', tone: 'neutral' }
};

export function SkillVersionStatusPill({ status }: { status: SkillSkillVersionStatus }) {
  const item = SKILL_VERSION_STATUS[status];
  return <StatusPill tone={item.tone}>{item.label}</StatusPill>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Fact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex justify-between gap-4 text-[12.5px]">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 break-all text-right text-ink">{children}</span>
    </div>
  );
}

/* ── 纯投影：时间线、可见范围摘要与替换载荷 ─────────────── */

/** 版本时间线（新→旧）。createdAt 是 ISO-8601 UTC 字符串，可直接字典序比较；同一时刻以更长的雪花 ID 视为更新。 */
export function skillVersionTimeline(versions: ReadonlyArray<SkillSkillVersion>): SkillSkillVersion[] {
  return [...versions].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt < right.createdAt ? 1 : -1;
    return right.id.length - left.id.length || (left.id < right.id ? 1 : -1);
  });
}

/** 最新版本 = 时间线首项；工作台行投影与详情默认选中复用同一比较规则。 */
export function latestSkillVersionFrom(versions: ReadonlyArray<SkillSkillVersion>) {
  return skillVersionTimeline(versions)[0];
}

/**
 * 包级可见范围摘要。刻意与可见范围编辑器读同一集合（不按 status 过滤）：
 * 服务端 assignments/batch 是无范围全量替换，看到的范围必须就是会被重发的范围。
 */
export function skillVisibilitySummary(assignments: ReadonlyArray<SkillSkillAssignment>) {
  if (assignments.some((assignment) => assignment.subjectType === 'ALL')) return '所有成员';
  const users = assignments.filter((assignment) => assignment.subjectType === 'USER').length;
  return users === 0 ? '未配置' : `${users} 人`;
}

export type SkillVisibilityDraft = {
  allVisible: boolean;
  userIds: string[];
};

export function skillVisibilityDraft(assignments: ReadonlyArray<SkillSkillAssignment>): SkillVisibilityDraft {
  return {
    allVisible: assignments.some((assignment) => assignment.subjectType === 'ALL'),
    userIds: assignments.filter((assignment) => assignment.subjectType === 'USER').map((assignment) => assignment.subjectId ?? '')
  };
}

/** 提交前的唯一校验点：ALL 不需要 subjectId，USER 必须有稳定成员 ID。 */
export function validateVisibilityDraft(draft: SkillVisibilityDraft) {
  return draft.userIds.some((userId) => !userId) ? '请选择成员' : undefined;
}

/**
 * 服务端 assignments/batch 是全量原子替换：这里交出的就是终态集合。
 * ALL 折叠为一条 subjectType=ALL，USER 逐条携带稳定 Member ID；界面之外没有需要原样透传的事实。
 */
export function skillAssignmentSpecs(draft: SkillVisibilityDraft): SkillSkillAssignmentSpec[] {
  const assignments: SkillSkillAssignmentSpec[] = [];
  if (draft.allVisible) assignments.push({ subjectType: 'ALL' });
  for (const userId of draft.userIds) assignments.push({ subjectType: 'USER', subjectId: userId });
  return assignments;
}

export type SkillAssignmentValue = {
  assignments: SkillSkillAssignmentSpec[];
  packageId: string;
  revision: number;
};

/* ── 只读展示 ─────────────────────────────────────────── */

/** 技能正文是 Agent 无条件加载的可执行指令，安全边界必须在写入面直接可见。 */
export function SkillSafetyNotice() {
  return (
    <div role="note" className="rounded-lg border border-line bg-orange-tint p-3">
      <p className="m-0 text-[12.5px] font-medium text-orange">安全提示</p>
      <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-2">
        技能正文是会被 Agent 无条件加载的可执行指令：只发布来自可信来源、且已由你本人审阅的技能包；发布后立即对可见范围内员工的 Agent 生效，请勿把未审阅或来路不明的 SKILL.md 放进企业目录。
      </p>
    </div>
  );
}

/** 单个包内每个 SKILL.md 的 frontmatter 投影；正文与脚本路径不在协议内，控制台也不应期待它们。 */
export function SkillEntriesPreview({ skills }: { skills: ReadonlyArray<SkillSkillEntry> }) {
  if (skills.length === 0) {
    return <p className="m-0 text-[12.5px] text-ink-3">服务端没有返回该版本的技能条目投影，请以技能数与包内 SKILL.md 为准。</p>;
  }
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {skills.map((skill) => (
        <li key={skill.name} className="grid gap-1.5 rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] font-medium text-ink">{skill.name}</span>
            <StatusPill tone={skill.modelInvocable ? 'accent' : 'neutral'}>{skill.modelInvocable ? '模型可调用' : '模型不可调用'}</StatusPill>
            <StatusPill tone={skill.userInvocable ? 'green' : 'neutral'}>{skill.userInvocable ? '用户可调用' : '用户不可调用'}</StatusPill>
          </div>
          <p className="m-0 text-[12.5px] leading-relaxed text-ink-2">{skill.description}</p>
          {skill.whenToUse ? <p className="m-0 text-[12px] leading-relaxed text-ink-3">何时使用：{skill.whenToUse}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function SkillManifestPreview({ version }: { version: SkillSkillVersion }) {
  return (
    <section className="grid gap-1.5 rounded-lg border border-line bg-canvas p-3">
      <Fact label="skillId">{version.skillId}</Fact>
      <Fact label="DSH 基线">{version.sourceDshVersion}</Fact>
      <Fact label="技能数">{version.skillCount}</Fact>
      <Fact label="大小">{formatBytes(version.sizeBytes)}</Fact>
      <Fact label="sha256">{version.sha256}</Fact>
      <Fact label="状态">{SKILL_VERSION_STATUS[version.status].label}</Fact>
    </section>
  );
}

/* ── 上传 ─────────────────────────────────────────────── */

export type SkillUploadValue = {
  artifact: File;
  metadata?: SkillSkillUploadMetadata;
};

/**
 * 上传是单次原子写：服务端验包成功后以 VALIDATED 落库并回填解析结果，
 * 抽屉随即切换为只读确认态，让管理员核对真实 manifest 与每个 SKILL.md 条目，而不是核对本地文件名。
 */
export function UploadSkillVersionDialog({
  error,
  onClose,
  onSave,
  parsed,
  saving
}: {
  error?: string;
  onClose: () => void;
  /** 上传成功后的服务端投影；有值时抽屉进入确认态。 */
  parsed?: SkillSkillVersion;
  onSave: (value: SkillUploadValue) => void;
  saving: boolean;
}) {
  const [artifact, setArtifact] = useState<File>();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string>();

  const submit = () => {
    if (!artifact || !artifact.name.toLowerCase().endsWith(SKILL_ARTIFACT_EXTENSION)) {
      setValidationError('请选择 .dshskill 技能包');
      return;
    }
    if (artifact.size > MAX_ARTIFACT_BYTES) {
      setValidationError('技能包不能超过 50 MiB');
      return;
    }
    const metadata: SkillSkillUploadMetadata = {};
    if (displayName.trim()) metadata.displayName = displayName.trim();
    if (description.trim()) metadata.description = description.trim();
    setValidationError(undefined);
    onSave({ artifact, ...(Object.keys(metadata).length ? { metadata } : {}) });
  };

  return (
    <ProductDialog title="上传技能包" className="max-w-[680px]" onClose={onClose}>
      {parsed ? (
        <div className="grid gap-4 p-5">
          <p className="m-0 text-[12.5px] text-ink-3">
            服务端已按 dsh-skill v1 解析并以 VALIDATED 写入；核对下面的 manifest 与 SKILL.md 条目后关闭。该版本在发布前对员工不可见。
          </p>
          <SkillManifestPreview version={parsed} />
          <section className="grid gap-2">
            <h3 className="m-0 text-[13px] font-semibold text-ink">SKILL.md 条目（{parsed.skills?.length ?? 0} / {parsed.skillCount}）</h3>
            <SkillEntriesPreview skills={parsed.skills ?? []} />
          </section>
        </div>
      ) : (
        <div className="grid gap-4 p-5">
          <p className="m-0 text-[12.5px] text-ink-3">
            服务端校验包内 manifest、每个 SKILL.md 的 frontmatter 与路径安全后写入目录，并回填解析出的 skillId、技能条目与调用策略。
          </p>
          <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
            技能包
            <input
              type="file"
              accept=".dshskill,application/vnd.dsh.skill+zip,application/zip"
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
      )}
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        {parsed ? (
          <Button type="button" variant="primary" size="sm" onClick={onClose}>完成</Button>
        ) : (
          <>
            <Button type="button" size="sm" onClick={onClose}>取消</Button>
            <Button type="button" variant="primary" size="sm" disabled={saving} onClick={submit}>{saving ? '解析中' : '上传并解析'}</Button>
          </>
        )}
      </footer>
    </ProductDialog>
  );
}

/* ── 可见范围 ─────────────────────────────────────────── */

/** 独立对话框与详情内联编辑共用的字段集合；状态由父级持有，保存时统一走 skillAssignmentSpecs。 */
export function SkillVisibilityFields({
  disabled,
  draft,
  onChange
}: {
  disabled?: boolean;
  draft: SkillVisibilityDraft;
  onChange: (draft: SkillVisibilityDraft) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={draft.allVisible}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, allVisible: event.target.checked })}
        />
        对所有成员可见
      </label>
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-ink-2">指定成员</span>
          <Button type="button" size="xs" disabled={disabled} onClick={() => onChange({ ...draft, userIds: [...draft.userIds, ''] })}>
            <Plus aria-hidden className="size-3.5" />
            添加
          </Button>
        </div>
        {draft.userIds.map((userId, index) => (
          <div key={`${index}-${userId}`} className="flex items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1.5 text-[12.5px] font-medium text-ink-2">
              成员
              <MemberSelect
                value={userId}
                onValueChange={(value) => onChange({ ...draft, userIds: draft.userIds.map((item, itemIndex) => itemIndex === index ? value : item) })}
              />
            </label>
            <Button
              type="button"
              variant="quiet"
              size="xs"
              className="size-8 rounded-md p-0 text-red"
              aria-label={`删除成员 ${index + 1}`}
              disabled={disabled}
              onClick={() => onChange({ ...draft, userIds: draft.userIds.filter((_, itemIndex) => itemIndex !== index) })}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          </div>
        ))}
        {draft.userIds.length === 0 && !draft.allVisible ? (
          <p className="m-0 text-[12px] text-ink-3">当前没有任何可见条目：保存后仅管理员可见。</p>
        ) : null}
      </div>
    </div>
  );
}

export function SkillAssignmentDialog({
  error,
  initialPackageId,
  onClose,
  onSave,
  packages,
  saving
}: {
  error?: string;
  initialPackageId?: string;
  onClose: () => void;
  onSave: (value: SkillAssignmentValue) => void;
  packages: ReadonlyArray<SkillSkillPackage>;
  saving: boolean;
}) {
  const initial = packages.find((item) => item.id === initialPackageId) ?? packages[0];
  const [packageId, setPackageId] = useState(initial?.id ?? '');
  const [draft, setDraft] = useState<SkillVisibilityDraft>(() => skillVisibilityDraft(initial?.assignments ?? []));
  const [validationError, setValidationError] = useState<string>();
  const selected = packages.find((item) => item.id === packageId);

  const selectPackage = (nextPackageId: string) => {
    const next = packages.find((item) => item.id === nextPackageId);
    setPackageId(nextPackageId);
    setDraft(skillVisibilityDraft(next?.assignments ?? []));
    setValidationError(undefined);
  };

  const submit = () => {
    if (!selected) return;
    const invalid = validateVisibilityDraft(draft);
    if (invalid) {
      setValidationError(invalid);
      return;
    }
    setValidationError(undefined);
    onSave({ assignments: skillAssignmentSpecs(draft), packageId: selected.id, revision: selected.revision });
  };

  return (
    <ProductDialog title="配置技能可见范围" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <p className="m-0 text-[12.5px] text-ink-3">保存时全量替换该技能包的 ALL/USER 可见范围；上传与发布不会自动对员工可见。</p>
        <label className="grid gap-1.5 text-[12.5px] font-medium text-ink-2">
          技能包
          <select className={inputClass} value={packageId} onChange={(event) => selectPackage(event.target.value)}>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}（{item.skillId}）</option>
            ))}
          </select>
        </label>
        <SkillVisibilityFields
          disabled={saving}
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setValidationError(undefined);
          }}
        />
        {validationError || error ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving || !selected} onClick={submit}>{saving ? '保存中' : '保存范围'}</Button>
      </footer>
    </ProductDialog>
  );
}

/* ── 详情 ─────────────────────────────────────────────── */

function subjectSummary(assignments: ReadonlyArray<SkillSkillAssignment>, memberNames: ReadonlyMap<string, string>) {
  if (assignments.length === 0) return '未配置可见成员（仅管理员可见）';
  if (assignments.some((assignment) => assignment.subjectType === 'ALL')) return '覆盖全部成员，含之后新增的成员';
  return assignments
    .map((assignment) => memberNames.get(assignment.subjectId ?? '') ?? assignment.subjectId ?? '未知成员')
    .join('、');
}

/**
 * 包级详情：元数据、版本历史、可见范围与每个 SKILL.md 条目的调用策略集中在一处，
 * 让管理员在按发布键之前能把「这个包里到底有什么」看完。
 */
export function SkillDetailDialog({
  assignmentError,
  assignmentsPending,
  canWrite,
  memberNames,
  onClose,
  onPublish,
  onRetire,
  onSaveAssignments,
  skillPackage,
  versionError,
  versionPending
}: {
  assignmentError?: string;
  assignmentsPending: boolean;
  canWrite: boolean;
  memberNames: ReadonlyMap<string, string>;
  onClose: () => void;
  onPublish: (version: SkillSkillVersion) => void;
  onRetire: (version: SkillSkillVersion) => void;
  onSaveAssignments: (value: SkillAssignmentValue) => void;
  skillPackage: SkillSkillPackage;
  versionError?: string;
  versionPending: boolean;
}) {
  const versions = skillVersionTimeline(skillPackage.versions);
  const newest = versions[0];
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(newest?.id);
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? newest;
  const [draft, setDraft] = useState<SkillVisibilityDraft>(() => skillVisibilityDraft(skillPackage.assignments));
  const [validationError, setValidationError] = useState<string>();

  const submitAssignments = () => {
    const invalid = validateVisibilityDraft(draft);
    if (invalid) {
      setValidationError(invalid);
      return;
    }
    setValidationError(undefined);
    onSaveAssignments({ assignments: skillAssignmentSpecs(draft), packageId: skillPackage.id, revision: skillPackage.revision });
  };

  return (
    <ProductDialog title="技能包详情" className="max-w-[720px]" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {newest ? <SkillVersionStatusPill status={newest.status} /> : <StatusPill tone="neutral">暂无版本</StatusPill>}
          <span className="text-[13px] font-medium text-ink">{skillPackage.displayName}</span>
          <span className="font-mono text-[11px] text-ink-3">{skillPackage.skillId}</span>
        </div>

        <SkillSafetyNotice />

        <section className="grid gap-1.5 rounded-lg border border-line bg-canvas p-3">
          <Fact label="显示名称">{skillPackage.displayName}</Fact>
          <Fact label="skillId">{skillPackage.skillId}</Fact>
          <Fact label="描述">{skillPackage.description ? skillPackage.description : '-'}</Fact>
          <Fact label="最新基线">{newest?.sourceDshVersion ?? '-'}</Fact>
          <Fact label="技能数">{newest?.skillCount ?? 0}</Fact>
          <Fact label="revision">{skillPackage.revision}</Fact>
        </section>

        <section className="grid gap-3 rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[13px] font-semibold text-ink">可见范围</h3>
            <span className="text-[12.5px] text-ink-2">{skillVisibilitySummary(skillPackage.assignments)}</span>
          </div>
          <p className="m-0 text-[12px] text-ink-3">{subjectSummary(skillPackage.assignments, memberNames)}</p>
          {canWrite ? (
            <>
              <SkillVisibilityFields
                disabled={assignmentsPending}
                draft={draft}
                onChange={(next) => {
                  setDraft(next);
                  setValidationError(undefined);
                }}
              />
              {validationError || assignmentError ? <p role="alert" className="m-0 text-[12.5px] text-red">{validationError ?? assignmentError}</p> : null}
              <div className="flex justify-end">
                <Button type="button" variant="primary" size="xs" disabled={assignmentsPending} onClick={submitAssignments}>
                  {assignmentsPending ? '保存中' : '保存范围'}
                </Button>
              </div>
            </>
          ) : (
            <p className="m-0 text-[12.5px] text-ink-3">当前角色只有读取权限（ent:skill:read），无法修改可见范围。</p>
          )}
        </section>

        <section className="grid gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-ink">版本历史（{versions.length}）</h3>
          {versions.length === 0 ? (
            <p className="m-0 text-[12.5px] text-ink-3">该技能包还没有版本。</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas p-2.5">
                  <button
                    type="button"
                    aria-pressed={selectedVersion?.id === version.id}
                    title="查看该版本的技能条目"
                    className={cn(
                      'min-w-0 flex-1 rounded-md text-left text-[12.5px] text-ink-2 transition-colors hover:text-ink',
                      selectedVersion?.id === version.id && 'text-ink'
                    )}
                    onClick={() => setSelectedVersionId(version.id)}
                  >
                    <span className="font-mono text-[12px] text-ink">{version.sourceDshVersion}</span>
                    <span className="ml-2 text-[11.5px] text-ink-3">
                      {formatDate(version.createdAt)} · 技能 {version.skillCount} · {formatBytes(version.sizeBytes)}
                    </span>
                  </button>
                  <span className="flex items-center gap-1.5">
                    <SkillVersionStatusPill status={version.status} />
                    {canWrite && version.status === 'VALIDATED' ? (
                      <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={versionPending} aria-label={`发布 ${version.sourceDshVersion}`} title="发布该版本" onClick={() => onPublish(version)}>
                        <CloudUpload aria-hidden className="size-3.5" />
                      </Button>
                    ) : null}
                    {canWrite && version.status === 'PUBLISHED' ? (
                      <Button variant="quiet" size="xs" className="size-7 rounded-md p-0" disabled={versionPending} aria-label={`下架 ${version.sourceDshVersion}`} title="下架该版本" onClick={() => onRetire(version)}>
                        <Archive aria-hidden className="size-3.5" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-ink">
            技能条目{selectedVersion ? `（${selectedVersion.sourceDshVersion} · ${selectedVersion.skillCount}）` : ''}
          </h3>
          <SkillEntriesPreview skills={selectedVersion?.skills ?? []} />
        </section>

        {versionError ? <p role="alert" className="m-0 text-[12.5px] text-red">{versionError}</p> : null}
      </div>
    </ProductDialog>
  );
}

export function RetireSkillVersionDialog({
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
  version: SkillSkillVersion;
}) {
  return (
    <ProductDialog title="下架技能版本" onClose={onClose}>
      <div className="grid gap-3 p-5 text-[13px] text-ink-2">
        <p className="m-0">确认下架 <strong className="text-ink">{version.skillId}@{version.sourceDshVersion}</strong>？</p>
        <p className="m-0">下架后停止新的授权下载；已导入本机的技能包不会远程撤回，仍会在员工 Agent 上生效。</p>
        {error ? <p role="alert" className="m-0 text-[12.5px] text-red">{error}</p> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button type="button" size="sm" onClick={onClose}>取消</Button>
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={onConfirm}>{saving ? '处理中' : '确认下架'}</Button>
      </footer>
    </ProductDialog>
  );
}
