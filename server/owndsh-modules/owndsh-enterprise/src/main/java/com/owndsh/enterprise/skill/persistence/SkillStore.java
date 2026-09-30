/**
 * [INPUT]: 接收 tenant、catalog/version CAS、完整 assignment 集合与可见 runtime 投影。
 * [OUTPUT]: 提供自然键幂等、USER/ALL 生效查询与主体存在性端口。
 * [POS]: skill application 的 PostgreSQL DIP 边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.persistence;

import com.owndsh.enterprise.skill.domain.SkillAssignment;
import com.owndsh.enterprise.skill.domain.SkillPackage;
import com.owndsh.enterprise.skill.domain.SkillVersion;
import com.owndsh.enterprise.skill.domain.RuntimeSkill;

import java.util.List;
import java.util.Optional;

public interface SkillStore {
    Optional<SkillPackage> findPackageBySkillIdForUpdate(String tenantId, String skillId);

    Optional<SkillPackage> findPackageById(String tenantId, long packageId);

    Optional<SkillPackage> findPackageByIdForUpdate(String tenantId, long packageId);

    List<SkillPackage> listPackages(String tenantId, long afterId, int limit);

    void insertPackage(SkillPackage skillPackage);

    boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision);

    Optional<SkillVersion> findExistingVersion(String tenantId, String skillId, String sourceDshVersion, String sha256);

    Optional<SkillVersion> findVersion(String tenantId, long versionId);

    List<SkillVersion> listVersions(String tenantId, long packageId);

    void insertVersion(SkillVersion version);

    boolean transitionVersion(String tenantId, long versionId, SkillVersion.Status from, SkillVersion.Status to, long expectedRevision);

    List<SkillAssignment> listAssignments(String tenantId, long packageId);

    void deleteAssignments(String tenantId, long packageId);

    void insertAssignment(SkillAssignment assignment);

    boolean subjectExists(SkillAssignment.SubjectType subjectType, long subjectId);

    List<RuntimeSkill> findVisiblePublished(String tenantId, long userId);

    Optional<RuntimeSkill> findVisiblePublishedById(String tenantId, long userId, long packageId);

    Optional<SkillVersion> findPublishedVersionForUser(String tenantId, long userId, long versionId);
}
