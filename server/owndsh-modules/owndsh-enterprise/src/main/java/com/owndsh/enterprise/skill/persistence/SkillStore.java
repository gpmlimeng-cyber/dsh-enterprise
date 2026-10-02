/**
 * [INPUT]: 接收 tenant、catalog/version/marks CAS、完整 assignment 集合与可见 runtime 投影。
 * [OUTPUT]: 提供自然键幂等、标记与包级分类写入、USER/ALL 与 builtin 并集可见查询与主体存在性端口。
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

    /** 以 revision 做 CAS，同时写入 builtin/featured 并递增 revision；命中 0 行表示并发冲突。 */
    boolean updatePackageMarks(
        String tenantId,
        long packageId,
        boolean builtin,
        boolean featured,
        long expectedRevision
    );

    /**
     * 以 revision 做 CAS，写入包级 category（null 表示没有分类）并递增 revision；命中 0 行表示并发冲突。
     *
     * <p>上传新版本时用本方法替代单纯递增 revision：添加版本与刷新包级声明在同一语句内完成。</p>
     */
    boolean updatePackageCategory(String tenantId, long packageId, String category, long expectedRevision);

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
