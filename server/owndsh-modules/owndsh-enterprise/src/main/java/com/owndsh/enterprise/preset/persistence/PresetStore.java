/**
 * [INPUT]: 接收 tenant、catalog/version CAS、完整 assignment 集合、可见 runtime 投影与待解析的技能/插件引用。
 * [OUTPUT]: 提供自然键幂等、USER→ALL 生效查询、主体存在性端口与引用解析（不存在/未发布/可分发）。
 * [POS]: preset application 的 PostgreSQL DIP 边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.persistence;

import com.owndsh.enterprise.preset.domain.PresetAssignment;
import com.owndsh.enterprise.preset.domain.PresetDependencyResolution;
import com.owndsh.enterprise.preset.domain.PresetPackage;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.domain.RuntimePreset;

import java.util.List;
import java.util.Optional;

public interface PresetStore {
    Optional<PresetPackage> findPackageByPresetIdForUpdate(String tenantId, String presetId);

    Optional<PresetPackage> findPackageById(String tenantId, long packageId);

    Optional<PresetPackage> findPackageByIdForUpdate(String tenantId, long packageId);

    List<PresetPackage> listPackages(String tenantId, long afterId, int limit);

    void insertPackage(PresetPackage presetPackage);

    boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision);

    Optional<PresetVersion> findExistingVersion(String tenantId, String presetId, String sourceDshVersion, String sha256);

    Optional<PresetVersion> findVersion(String tenantId, long versionId);

    List<PresetVersion> listVersions(String tenantId, long packageId);

    void insertVersion(PresetVersion version);

    boolean transitionVersion(String tenantId, long versionId, PresetVersion.Status from, PresetVersion.Status to, long expectedRevision);

    List<PresetAssignment> listAssignments(String tenantId, long packageId);

    void deleteAssignments(String tenantId, long packageId);

    void insertAssignment(PresetAssignment assignment);

    boolean subjectExists(PresetAssignment.SubjectType subjectType, long subjectId);

    List<RuntimePreset> findVisiblePublished(String tenantId, long userId);

    Optional<RuntimePreset> findVisiblePublishedById(String tenantId, long userId, long packageId);

    Optional<PresetVersion> findPublishedVersionForUser(String tenantId, long userId, long versionId);

    /**
     * 解析一条 `dependencies` 引用在中心侧的当前可分发状态（只读，两跳以内单条查询）。
     *
     * @param tenantId  租户
     * @param kind      `skill` | `plugin`；未知值一律按 {@link PresetDependencyResolution#MISSING} 返回（形状闸在调用方）
     * @param id        技能 skillId 或 npm package name
     * @param versionId pinned 时的雪花 ID 十进制字符串；`latest` 传 null
     * @return 不存在 / 存在但不可分发 / 可分发
     */
    PresetDependencyResolution resolveDependency(String tenantId, String kind, String id, String versionId);
}
