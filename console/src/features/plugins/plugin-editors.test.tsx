/**
 * [INPUT]: 依赖 Vitest、Testing Library、生成插件 DTO 与 PluginAssignmentDialog/上传对话框。
 * [OUTPUT]: 锁定保存可见范围时不可编辑的 DEPT 事实必须原样重发，以及上传对话框只放行 .tgz/.tar.gz/.zip 的格式门禁。
 * [POS]: features/plugins 的可见范围写入门禁，防止服务端全量替换语义静默删除控制台未呈现的分配。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PluginAssignment, PluginPackage, PluginVersion } from '@/api/generated/types.gen';
import { PluginAssignmentDialog, UploadPluginVersionDialog, type PluginAssignmentValue } from './plugin-editors';

const PUBLISHED_VERSION: PluginVersion = {
  id: '101',
  packageId: '10',
  packageName: '@example/acme-tools',
  version: '1.2.3',
  sizeBytes: 4096,
  sha256: '0'.repeat(64),
  signatureBase64: '',
  compatibility: {
    harnessCommits: ['b150a551b8d465e31e418e1b2eaf5e79bbb7d28e'],
    enterpriseBundleRange: '>=0.1.0 <0.2.0',
    operatingSystems: ['darwin']
  },
  status: 'PUBLISHED',
  createdAt: '2026-01-01T00:00:00Z',
  revision: 1
};

function assignment(overrides: Partial<PluginAssignment>): PluginAssignment {
  return {
    id: '201',
    packageId: '10',
    pluginVersionId: '101',
    subjectType: 'ALL',
    subjectId: null,
    desiredState: 'INSTALLED',
    required: false,
    status: 'ACTIVE',
    revision: 0,
    ...overrides
  };
}

function pluginPackage(assignments: PluginAssignment[]): PluginPackage {
  return {
    id: '10',
    packageName: '@example/acme-tools',
    displayName: 'Acme Tools',
    status: 'ACTIVE',
    revision: 3,
    versions: [PUBLISHED_VERSION],
    assignments
  };
}

const DEPT_ASSIGNMENT = assignment({
  id: '301',
  subjectType: 'DEPT',
  subjectId: '77'
});

describe('save visibility scope', () => {
  it('re-emits a loaded DEPT assignment the console cannot edit', () => {
    const onSave = vi.fn();
    render(
      <PluginAssignmentDialog
        packages={[pluginPackage([assignment({}), DEPT_ASSIGNMENT])]}
        saving={false}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '保存范围' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const value = onSave.mock.calls[0][0] as PluginAssignmentValue;
    expect(value.items).toContainEqual({
      pluginVersionId: '101',
      subjectType: 'DEPT',
      subjectId: '77',
      desiredState: 'INSTALLED',
      required: false
    });
  });
});

describe('upload plugin artifact format', () => {
  it('accepts .zip and rejects an unsupported extension', () => {
    const onSave = vi.fn();
    render(
      <UploadPluginVersionDialog
        saving={false}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['zip'], 'plugin.zip', { type: 'application/zip' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: '上传并验证' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('请选择 .tgz、.tar.gz 或 .zip 插件包')).toBeNull();

    fireEvent.change(input, {
      target: { files: [new File(['txt'], 'plugin.txt', { type: 'text/plain' })] }
    });
    fireEvent.click(screen.getByRole('button', { name: '上传并验证' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('请选择 .tgz、.tar.gz 或 .zip 插件包')).not.toBeNull();
  });
});
