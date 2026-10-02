/**
 * [INPUT]: 依赖 V30 表、V39 dependencies 列、Spring JDBC 与 Jackson（dependencies jsonb 序列化）。
 * [OUTPUT]: 实现 preset catalog/version/assignment、可见 runtime 查询与技能/插件引用解析。
 * [POS]: preset/persistence 的 PostgreSQL adapter，USER 优先于 ALL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.persistence;

import com.owndsh.enterprise.preset.domain.PresetAssignment;
import com.owndsh.enterprise.preset.domain.PresetDependency;
import com.owndsh.enterprise.preset.domain.PresetDependencyResolution;
import com.owndsh.enterprise.preset.domain.PresetPackage;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.domain.RuntimePreset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class JdbcPresetStore implements PresetStore {
    private static final TypeReference<List<PresetDependency>> DEPENDENCIES = new TypeReference<>() {
    };
    private static final RowMapper<PresetPackage> PACKAGE = (rs, i) -> new PresetPackage(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getString("preset_id"),
        rs.getString("display_name"), rs.getString("description"),
        PresetPackage.Status.valueOf(rs.getString("status")), rs.getLong("revision")
    );
    private static final RowMapper<PresetAssignment> ASSIGNMENT = (rs, i) -> new PresetAssignment(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("package_id"),
        PresetAssignment.SubjectType.valueOf(rs.getString("subject_type")),
        (Long) rs.getObject("subject_id"),
        PresetAssignment.Status.valueOf(rs.getString("status")), rs.getLong("revision")
    );
    private static final RowMapper<RuntimePreset> RUNTIME = (rs, i) -> new RuntimePreset(
        rs.getLong("package_id"), rs.getString("preset_id"), rs.getString("display_name"),
        rs.getString("description"), rs.getLong("version_id"), rs.getString("source_dsh_version"),
        rs.getLong("size_bytes"), rs.getString("sha256"), rs.getTimestamp("updated_at").toInstant()
    );

    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    /** version mapper 是实例字段：dependencies jsonb 需要 JsonMapper 反序列化（同 JdbcSkillStore 先例）。 */
    private final RowMapper<PresetVersion> versionMapper = (rs, i) -> new PresetVersion(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("package_id"),
        rs.getString("source_dsh_version"), rs.getString("artifact_ref"),
        rs.getLong("size_bytes"), rs.getString("sha256"), dependencies(rs.getString("dependencies")),
        PresetVersion.Status.valueOf(rs.getString("status")), rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant(), rs.getLong("revision")
    );

    public JdbcPresetStore(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    private List<PresetDependency> dependencies(String value) {
        if (value == null || value.isBlank()) return List.of();
        return json.readValue(value, DEPENDENCIES);
    }

    @Override
    public Optional<PresetPackage> findPackageByPresetIdForUpdate(String tenantId, String presetId) {
        return one(jdbc.query(
            "select * from ent_preset_package where tenant_id = ? and preset_id = ? for update",
            PACKAGE, tenantId, presetId
        ));
    }

    @Override
    public Optional<PresetPackage> findPackageById(String tenantId, long packageId) {
        return one(jdbc.query(
            "select * from ent_preset_package where tenant_id = ? and id = ?", PACKAGE, tenantId, packageId
        ));
    }

    @Override
    public Optional<PresetPackage> findPackageByIdForUpdate(String tenantId, long packageId) {
        return one(jdbc.query(
            "select * from ent_preset_package where tenant_id = ? and id = ? for update",
            PACKAGE, tenantId, packageId
        ));
    }

    @Override
    public List<PresetPackage> listPackages(String tenantId, long afterId, int limit) {
        return jdbc.query(
            "select * from ent_preset_package where tenant_id = ? and id > ? order by id asc limit ?",
            PACKAGE, tenantId, afterId, limit
        );
    }

    @Override
    public void insertPackage(PresetPackage presetPackage) {
        jdbc.update(
            "insert into ent_preset_package (id, tenant_id, preset_id, display_name, description, status, revision) values (?,?,?,?,?,?,?)",
            presetPackage.id(), presetPackage.tenantId(), presetPackage.presetId(), presetPackage.displayName(),
            presetPackage.description(), presetPackage.status().name(), presetPackage.revision()
        );
    }

    @Override
    public boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision) {
        return jdbc.update(
            "update ent_preset_package set revision = revision + 1 where tenant_id = ? and id = ? and revision = ?",
            tenantId, packageId, expectedRevision
        ) == 1;
    }

    @Override
    public Optional<PresetVersion> findExistingVersion(
        String tenantId, String presetId, String sourceDshVersion, String sha256
    ) {
        return one(jdbc.query(
            """
            select v.* from ent_preset_version v
            join ent_preset_package p on p.id = v.package_id
            where v.tenant_id = ? and p.preset_id = ? and v.source_dsh_version = ? and v.sha256 = ?
            """,
            versionMapper, tenantId, presetId, sourceDshVersion, sha256
        ));
    }

    @Override
    public Optional<PresetVersion> findVersion(String tenantId, long versionId) {
        return one(jdbc.query(
            "select * from ent_preset_version where tenant_id = ? and id = ?", versionMapper, tenantId, versionId
        ));
    }

    @Override
    public List<PresetVersion> listVersions(String tenantId, long packageId) {
        return jdbc.query(
            "select * from ent_preset_version where tenant_id = ? and package_id = ? order by created_at desc, id desc",
            versionMapper, tenantId, packageId
        );
    }

    @Override
    public void insertVersion(PresetVersion version) {
        jdbc.update(
            """
            insert into ent_preset_version
            (id, tenant_id, package_id, source_dsh_version, artifact_ref, size_bytes, sha256, dependencies,
             status, created_by, created_at, revision)
            values (?,?,?,?,?,?,?,?::jsonb,?,?,?,?)
            """,
            version.id(), version.tenantId(), version.packageId(), version.sourceDshVersion(), version.artifactRef(),
            version.sizeBytes(), version.sha256(), json.writeValueAsString(version.dependencies()),
            version.status().name(), version.createdBy(),
            java.sql.Timestamp.from(version.createdAt()), version.revision()
        );
    }

    @Override
    public boolean transitionVersion(
        String tenantId, long versionId, PresetVersion.Status from, PresetVersion.Status to, long expectedRevision
    ) {
        int updated = expectedRevision == 0
            ? jdbc.update(
                "update ent_preset_version set status = ?, revision = revision + 1 where tenant_id = ? and id = ? and status = ? and revision = 0",
                to.name(), tenantId, versionId, from.name()
            )
            : jdbc.update(
                "update ent_preset_version set status = ?, revision = revision + 1 where tenant_id = ? and id = ? and status = ? and revision = ?",
                to.name(), tenantId, versionId, from.name(), expectedRevision
            );
        return updated == 1;
    }

    @Override
    public List<PresetAssignment> listAssignments(String tenantId, long packageId) {
        return jdbc.query(
            "select * from ent_preset_assignment where tenant_id = ? and package_id = ? order by id asc",
            ASSIGNMENT, tenantId, packageId
        );
    }

    @Override
    public void deleteAssignments(String tenantId, long packageId) {
        jdbc.update("delete from ent_preset_assignment where tenant_id = ? and package_id = ?", tenantId, packageId);
    }

    @Override
    public void insertAssignment(PresetAssignment assignment) {
        jdbc.update(
            "insert into ent_preset_assignment (id, tenant_id, package_id, subject_type, subject_id, status, revision) values (?,?,?,?,?,?,?)",
            assignment.id(), assignment.tenantId(), assignment.packageId(), assignment.subjectType().name(),
            assignment.subjectId(), assignment.status().name(), assignment.revision()
        );
    }

    @Override
    public boolean subjectExists(PresetAssignment.SubjectType subjectType, long subjectId) {
        if (subjectType == PresetAssignment.SubjectType.ALL) return true;
        Integer count = jdbc.queryForObject(
            "select count(*) from sys_user where user_id = ?", Integer.class, subjectId
        );
        return count != null && count > 0;
    }

    @Override
    public List<RuntimePreset> findVisiblePublished(String tenantId, long userId) {
        return jdbc.query(
            """
            select p.id as package_id, p.preset_id, p.display_name, p.description,
                   v.id as version_id, v.source_dsh_version, v.size_bytes, v.sha256, v.created_at as updated_at
            from ent_preset_package p
            join ent_preset_version v on v.id = (
                select v2.id from ent_preset_version v2
                where v2.package_id = p.id and v2.status = 'PUBLISHED'
                order by v2.created_at desc, v2.id desc limit 1
            )
            where p.tenant_id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
              and exists (
                select 1 from ent_preset_assignment a
                where a.package_id = p.id and a.status = 'ACTIVE'
                  and (
                    (a.subject_type = 'ALL' and a.subject_id is null)
                    or (a.subject_type = 'USER' and a.subject_id = ?)
                  )
              )
            order by v.created_at desc, p.id desc
            """,
            RUNTIME, tenantId, userId
        );
    }

    @Override
    public Optional<RuntimePreset> findVisiblePublishedById(String tenantId, long userId, long packageId) {
        return one(jdbc.query(
            """
            select p.id as package_id, p.preset_id, p.display_name, p.description,
                   v.id as version_id, v.source_dsh_version, v.size_bytes, v.sha256, v.created_at as updated_at
            from ent_preset_package p
            join ent_preset_version v on v.id = (
                select v2.id from ent_preset_version v2
                where v2.package_id = p.id and v2.status = 'PUBLISHED'
                order by v2.created_at desc, v2.id desc limit 1
            )
            where p.tenant_id = ? and p.id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
              and exists (
                select 1 from ent_preset_assignment a
                where a.package_id = p.id and a.status = 'ACTIVE'
                  and (
                    (a.subject_type = 'ALL' and a.subject_id is null)
                    or (a.subject_type = 'USER' and a.subject_id = ?)
                  )
              )
            """,
            RUNTIME, tenantId, packageId, userId
        ));
    }

    @Override
    public Optional<PresetVersion> findPublishedVersionForUser(String tenantId, long userId, long versionId) {
        return one(jdbc.query(
            """
            select v.* from ent_preset_version v
            join ent_preset_package p on p.id = v.package_id
            where v.tenant_id = ? and v.id = ? and v.status = 'PUBLISHED' and p.status = 'ACTIVE'
              and exists (
                select 1 from ent_preset_assignment a
                where a.package_id = p.id and a.status = 'ACTIVE'
                  and (
                    (a.subject_type = 'ALL' and a.subject_id is null)
                    or (a.subject_type = 'USER' and a.subject_id = ?)
                  )
              )
            """,
            versionMapper, tenantId, versionId, userId
        ));
    }

    @Override
    public PresetDependencyResolution resolveDependency(String tenantId, String kind, String id, String versionId) {
        return switch (kind) {
            case PresetDependency.KIND_SKILL -> resolveSkillDependency(tenantId, id, versionId);
            case PresetDependency.KIND_PLUGIN -> resolvePluginDependency(tenantId, id, versionId);
            // 形状闸已在发布口拒绝未知 kind；这里的兜底只保证 DIP 边界不回显任何东西。
            default -> PresetDependencyResolution.MISSING;
        };
    }

    /**
     * 技能引用：pinned 时按 (versionId, skillId) 定位；latest 时看该技能包是否已有 PUBLISHED 版本。
     * 两跳以内单条 SQL，不做跨包外键（引用是软约束）。
     */
    private PresetDependencyResolution resolveSkillDependency(String tenantId, String id, String versionId) {
        Long pinned = pinnedId(versionId);
        if (versionId != null && pinned == null) return PresetDependencyResolution.MISSING;
        String sql = pinned == null
            ? """
              select p.status as package_status,
                     (select count(*) from ent_skill_version v
                       where v.package_id = p.id and v.status = 'PUBLISHED') > 0 as distributable
              from ent_skill_package p
              where p.tenant_id = ? and p.skill_id = ?
              """
            : """
              select p.status as package_status, v.status = 'PUBLISHED' as distributable
              from ent_skill_version v
              join ent_skill_package p on p.id = v.package_id
              where v.tenant_id = ? and p.tenant_id = ? and v.id = ? and p.skill_id = ?
              """;
        List<DependencyRow> rows = pinned == null
            ? jdbc.query(sql, DEPENDENCY_ROW, tenantId, id)
            : jdbc.query(sql, DEPENDENCY_ROW, tenantId, tenantId, pinned, id);
        return one(rows).map(JdbcPresetStore::resolve).orElse(PresetDependencyResolution.MISSING);
    }

    /** 插件引用：与技能同构，包名锚在 ent_plugin_package.package_name（npm 名）。 */
    private PresetDependencyResolution resolvePluginDependency(String tenantId, String id, String versionId) {
        Long pinned = pinnedId(versionId);
        if (versionId != null && pinned == null) return PresetDependencyResolution.MISSING;
        String sql = pinned == null
            ? """
              select p.status as package_status,
                     (select count(*) from ent_plugin_version v
                       where v.package_id = p.id and v.status = 'PUBLISHED') > 0 as distributable
              from ent_plugin_package p
              where p.tenant_id = ? and p.package_name = ?
              """
            : """
              select p.status as package_status, v.status = 'PUBLISHED' as distributable
              from ent_plugin_version v
              join ent_plugin_package p on p.id = v.package_id
              where v.tenant_id = ? and p.tenant_id = ? and v.id = ? and p.package_name = ?
              """;
        List<DependencyRow> rows = pinned == null
            ? jdbc.query(sql, DEPENDENCY_ROW, tenantId, id)
            : jdbc.query(sql, DEPENDENCY_ROW, tenantId, tenantId, pinned, id);
        return one(rows).map(JdbcPresetStore::resolve).orElse(PresetDependencyResolution.MISSING);
    }

    private static PresetDependencyResolution resolve(DependencyRow row) {
        if (!"ACTIVE".equals(row.packageStatus())) return PresetDependencyResolution.NOT_PUBLISHED;
        return row.distributable() ? PresetDependencyResolution.RESOLVED : PresetDependencyResolution.NOT_PUBLISHED;
    }

    /** 形状闸已保证雪花 ID 的十进制形状；这里仍防御性吞掉非法值，避免 500。 */
    private static Long pinnedId(String versionId) {
        if (versionId == null) return null;
        try {
            return Long.valueOf(versionId);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static <T> Optional<T> one(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    private record DependencyRow(String packageStatus, boolean distributable) {
    }

    private static final RowMapper<DependencyRow> DEPENDENCY_ROW = (rs, i) -> new DependencyRow(
        rs.getString("package_status"), rs.getBoolean("distributable")
    );
}
