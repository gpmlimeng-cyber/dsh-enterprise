/**
 * [INPUT]: 依赖 Vitest、Testing Library、生成技能 DTO 与技能上传/可见范围/详情对话框。
 * [OUTPUT]: 锁定 .dshskill 扩展名门禁、上传后切换为服务端解析确认态、可见范围折叠为 ALL/USER 全量替换载荷，以及详情的安全提示、条目调用策略与逐版本动作。
 * [POS]: features/skills 的写入门禁，防止全量替换语义下可见范围被静默改写，并保证上传确认页只呈现服务端投影。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkillSkillEntry, SkillSkillPackage, SkillSkillVersion } from '@/api/generated/types.gen';
import {
  SkillAssignmentDialog,
  SkillDetailDialog,
  UploadSkillVersionDialog,
  skillAssignmentSpecs,
  skillVersionTimeline,
  skillVisibilityDraft,
  validateVisibilityDraft,
  type SkillAssignmentValue
} from './skill-editors';

// vitest 未开 globals，Testing Library 的自动 cleanup 不会注册；不清理会让上一个用例的对话框留在 document 里。
afterEach(cleanup);

const ENTRY: SkillSkillEntry = {
  name: 'weekly-digest',
  description: '把本周的提交与事件整理成一份可发送的周报。',
  whenToUse: '当用户要求汇总本周进展时',
  modelInvocable: true,
  userInvocable: true
};

function version(overrides: Partial<SkillSkillVersion>): SkillSkillVersion {
  return {
    id: '101',
    packageId: '10',
    skillId: 'weekly-report',
    sourceDshVersion: '0.1.7-rc.2',
    sizeBytes: 2048,
    sha256: 'a'.repeat(64),
    status: 'VALIDATED',
    skillCount: 1,
    createdAt: '2026-09-01T00:00:00Z',
    revision: 0,
    ...overrides
  };
}

function skillPackage(overrides: Partial<SkillSkillPackage>): SkillSkillPackage {
  return {
    id: '10',
    skillId: 'weekly-report',
    builtin: false,
    featured: false,
    displayName: '周报技能包',
    status: 'ACTIVE',
    revision: 3,
    versions: [version({})],
    assignments: [],
    ...overrides
  };
}

describe('skill artifact gate', () => {
  it('accepts a .dshskill package and rejects any other extension', () => {
    const onSave = vi.fn();
    render(<UploadSkillVersionDialog saving={false} onClose={() => undefined} onSave={onSave} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(['zip'], 'weekly.zip', { type: 'application/zip' })] } });
    fireEvent.click(screen.getByRole('button', { name: '上传并解析' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('请选择 .dshskill 技能包')).toBeTruthy();

    const artifact = new File(['skill'], 'weekly.dshskill', { type: 'application/vnd.dsh.skill+zip' });
    fireEvent.change(input, { target: { files: [artifact] } });
    fireEvent.change(screen.getByLabelText(/显示名称/), { target: { value: '周报技能包' } });
    fireEvent.click(screen.getByRole('button', { name: '上传并解析' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({ artifact, metadata: { displayName: '周报技能包' } });
  });
});

describe('server parsed confirmation', () => {
  it('shows the parsed manifest and every SKILL.md entry instead of the form', () => {
    const onClose = vi.fn();
    render(
      <UploadSkillVersionDialog
        parsed={version({ status: 'VALIDATED', skillCount: 1, skills: [ENTRY] })}
        saving={false}
        onClose={onClose}
        onSave={() => undefined}
      />
    );

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText('weekly-report')).toBeTruthy();
    expect(screen.getByText('0.1.7-rc.2')).toBeTruthy();
    expect(screen.getByText('SKILL.md 条目（1 / 1）')).toBeTruthy();
    expect(screen.getByText('weekly-digest')).toBeTruthy();
    expect(screen.getByText(ENTRY.description)).toBeTruthy();
    expect(screen.getByText('何时使用：当用户要求汇总本周进展时')).toBeTruthy();
    expect(screen.getByText('模型可调用')).toBeTruthy();
    expect(screen.getByText('用户可调用')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('visibility replacement payload', () => {
  it('collapses ALL into a single spec and keeps stable member IDs', () => {
    expect(skillAssignmentSpecs({ allVisible: true, userIds: ['202', '203'] })).toEqual([
      { subjectType: 'ALL' },
      { subjectType: 'USER', subjectId: '202' },
      { subjectType: 'USER', subjectId: '203' }
    ]);
    // 全空是可表达终态：保存后仅管理员可见，而不是“没改动”。
    expect(skillAssignmentSpecs({ allVisible: false, userIds: [] })).toEqual([]);
    expect(validateVisibilityDraft({ allVisible: true, userIds: ['', '202'] })).toBe('请选择成员');
    expect(validateVisibilityDraft({ allVisible: false, userIds: ['202'] })).toBeUndefined();
  });

  it('rehydrates the editable draft from the loaded package without dropping USER entries', () => {
    expect(skillVisibilityDraft([
      { id: '201', packageId: '10', subjectType: 'ALL', status: 'ACTIVE', revision: 0 },
      { id: '202', packageId: '10', subjectType: 'USER', subjectId: '202', status: 'ACTIVE', revision: 0 }
    ])).toEqual({ allVisible: true, userIds: ['202'] });
  });

  it('submits the whole replacement set together with the loaded revision', () => {
    const onSave = vi.fn();
    render(
      <SkillAssignmentDialog
        packages={[skillPackage({ assignments: [{ id: '201', packageId: '10', subjectType: 'ALL', status: 'ACTIVE', revision: 0 }] })]}
        saving={false}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '保存范围' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const value = onSave.mock.calls[0][0] as SkillAssignmentValue;
    expect(value.packageId).toBe('10');
    expect(value.revision).toBe(3);
    expect(value.assignments).toEqual([{ subjectType: 'ALL' }]);
  });
});

describe('skill package detail', () => {
  it('warns about executable content, lists the version history and routes per-version actions', () => {
    const onPublish = vi.fn();
    const onSaveAssignments = vi.fn();
    render(
      <SkillDetailDialog
        assignmentsPending={false}
        canWrite
        memberNames={new Map()}
        versionPending={false}
        skillPackage={skillPackage({
          versions: [
            version({ id: '102', status: 'PUBLISHED', sourceDshVersion: '0.1.8', createdAt: '2026-09-10T00:00:00Z', skills: [ENTRY] }),
            version({ id: '101', status: 'VALIDATED', skills: [] })
          ]
        })}
        onClose={() => undefined}
        onPublish={onPublish}
        onRetire={() => undefined}
        onSaveAssignments={onSaveAssignments}
      />
    );

    expect(screen.getByText(/技能正文是会被 Agent 无条件加载的可执行指令/)).toBeTruthy();
    expect(screen.getByText('版本历史（2）')).toBeTruthy();
    // 版本行本身是可选中按钮；已发布版本的下架动作按版本（而非包）寻址。
    expect(screen.getByRole('button', { name: /^0\.1\.8/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下架 0.1.8' })).toBeTruthy();
    // 最新版本（PUBLISHED）的条目默认展开，调用策略来自服务端投影。
    expect(screen.getByText('weekly-digest')).toBeTruthy();
    expect(screen.getByText('未配置可见成员（仅管理员可见）')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '发布 0.1.7-rc.2' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0][0]).toMatchObject({ id: '101', status: 'VALIDATED' });

    // 详情内联的可见范围保存与独立对话框是同一份全量替换载荷。
    fireEvent.click(screen.getByRole('button', { name: '保存范围' }));
    expect(onSaveAssignments).toHaveBeenCalledWith({ assignments: [], packageId: '10', revision: 3 });
  });

  it('orders versions newest first and hides write actions from read-only roles', () => {
    expect(skillVersionTimeline([
      version({ id: '101', createdAt: '2026-09-01T00:00:00Z' }),
      version({ id: '102', createdAt: '2026-09-10T00:00:00Z' })
    ]).map((item) => item.id)).toEqual(['102', '101']);

    render(
      <SkillDetailDialog
        assignmentsPending={false}
        canWrite={false}
        memberNames={new Map()}
        versionPending={false}
        skillPackage={skillPackage({ versions: [version({ status: 'VALIDATED' })] })}
        onClose={() => undefined}
        onPublish={() => undefined}
        onRetire={() => undefined}
        onSaveAssignments={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: '发布 0.1.7-rc.2' })).toBeNull();
    expect(screen.queryByRole('button', { name: '保存范围' })).toBeNull();
    expect(screen.getByText(/只有读取权限/)).toBeTruthy();
  });
});
