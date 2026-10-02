/**
 * [INPUT]: 依赖生成的技能上传序列化 helper、包级行投影与浏览器 FormData 行为。
 * [OUTPUT]: 锁定 .dshskill 上传保持 File 本体并以 application/json Blob 发送 metadata，以及工作台行取最新版本、技能数与可见范围摘要的投影。
 * [POS]: features/skills 的 Spring RequestPart 契约与列表投影门禁，不启动浏览器与网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import type { SkillSkillAssignment, SkillSkillPackage, SkillSkillVersion } from '@/api/generated/types.gen';
import { serializeSkillUpload, toSkillPackageRow } from './skill-management-page';

function version(overrides: Partial<SkillSkillVersion>): SkillSkillVersion {
  return {
    id: '101',
    packageId: '10',
    skillId: 'weekly-report',
    sourceDshVersion: '0.1.7-rc.2',
    sizeBytes: 2048,
    sha256: 'a'.repeat(64),
    status: 'VALIDATED',
    skillCount: 2,
    createdAt: '2026-09-01T00:00:00Z',
    revision: 0,
    ...overrides
  };
}

function assignment(overrides: Partial<SkillSkillAssignment>): SkillSkillAssignment {
  return {
    id: '201',
    packageId: '10',
    subjectType: 'USER',
    subjectId: '202',
    status: 'ACTIVE',
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

describe('serializeSkillUpload', () => {
  it('keeps the binary artifact and sends metadata as an application/json part', () => {
    const artifact = new File([new Uint8Array([1, 2, 3])], 'weekly.dshskill', { type: 'application/vnd.dsh.skill+zip' });
    const body = serializeSkillUpload({
      artifact,
      metadata: { displayName: '周报技能包', description: 'demo' }
    });
    expect(body.get('artifact')).toBe(artifact);
    const metadata = body.get('metadata');
    expect(metadata).toBeInstanceOf(Blob);
    expect((metadata as Blob).type).toBe('application/json');
  });

  it('omits metadata when the admin keeps the in-package manifest', () => {
    const artifact = new File([new Uint8Array([1])], 'a.dshskill');
    const body = serializeSkillUpload({ artifact });
    expect(body.get('metadata')).toBeNull();
    expect(body.get('artifact')).toBe(artifact);
  });
});

describe('toSkillPackageRow', () => {
  it('folds the newest version and the visibility set into the workbench columns', () => {
    const row = toSkillPackageRow(skillPackage({
      versions: [
        version({ id: '101', createdAt: '2026-09-01T00:00:00Z', status: 'RETIRED', skillCount: 1 }),
        version({ id: '103', createdAt: '2026-09-10T00:00:00Z', status: 'PUBLISHED', skillCount: 3, sourceDshVersion: '0.1.8' })
      ],
      assignments: [assignment({}), assignment({ id: '202', subjectId: '203' })]
    }));
    expect(row.status).toBe('PUBLISHED');
    expect(row.sourceDshVersion).toBe('0.1.8');
    expect(row.skillCount).toBe(3);
    expect(row.updatedAt).toBe('2026-09-10T00:00:00Z');
    expect(row.visibility).toBe('2 人');
    // 详情与范围编辑器消费同一对象，包级字段必须原样保留。
    expect(row.id).toBe('10');
    expect(row.revision).toBe(3);
    expect(row.versions).toHaveLength(2);
  });

  it('reports ALL visibility and an empty catalog without inventing a version', () => {
    const all = toSkillPackageRow(skillPackage({ assignments: [assignment({ subjectType: 'ALL', subjectId: undefined })] }));
    expect(all.visibility).toBe('所有成员');

    const empty = toSkillPackageRow(skillPackage({ versions: [] }));
    expect(empty.status).toBe('EMPTY');
    expect(empty.sourceDshVersion).toBe('-');
    expect(empty.skillCount).toBe(0);
    expect(empty.updatedAt).toBeUndefined();
    expect(empty.visibility).toBe('未配置');
  });
});
