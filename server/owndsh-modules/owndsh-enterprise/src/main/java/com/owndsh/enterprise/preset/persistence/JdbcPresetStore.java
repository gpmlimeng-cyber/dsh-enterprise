/**
 * [INPUT]: 依赖 V30 表与 Spring JDBC。
 * [OUTPUT]: 实现 preset catalog/version/assignment 与可见 runtime 查询。
 * [POS]: preset/persistence 的 PostgreSQL adapter，USER 优先于 ALL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.persistence;

import com.owndsh.enterprise.preset.domain.PresetAssignment;
import com.owndsh.enterprise.preset.domain.PresetPackage;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.domain.RuntimePreset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class JdbcPresetStore implements PresetStore {
    private static final RowMapper<PresetPackage> PACKAGE = (rs, i) -> new PresetPackage(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getString("preset_id"),
        rs.getString("display_name"), rs.getString("description"),
        PresetPackage.Status.valueOf(rs.getString("status")), rs.getLong("revision")
    );
    private static final RowMapper<PresetVersion> VERSION = (rs, i) -> new PresetVersion(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("package_id"),
        rs.getString("source_dsh_version"), rs.getString("artifact_ref"),
        rs.getLong("size_bytes"), rs.getString("sha256"),
        PresetVersion.Status.valueOf(rs.getString("status")), rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant(), rs.getLong("revision")
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

    public JdbcPresetStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
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
            VERSION, tenantId, presetId, sourceDshVersion, sha256
        ));
    }

    @Override
    public Optional<PresetVersion> findVersion(String tenantId, long versionId) {
        return one(jdbc.query(
            "select * from ent_preset_version where tenant_id = ? and id = ?", VERSION, tenantId, versionId
        ));
    }

    @Override
    public List<PresetVersion> listVersions(String tenantId, long packageId) {
        return jdbc.query(
            "select * from ent_preset_version where tenant_id = ? and package_id = ? order by created_at desc, id desc",
            VERSION, tenantId, packageId
        );
    }

    @Override
    public void insertVersion(PresetVersion version) {
        jdbc.update(
            """
            insert into ent_preset_version
            (id, tenant_id, package_id, source_dsh_version, artifact_ref, size_bytes, sha256, status, created_by, created_at, revision)
            values (?,?,?,?,?,?,?,?,?,?,?)
            """,
            version.id(), version.tenantId(), version.packageId(), version.sourceDshVersion(), version.artifactRef(),
            version.sizeBytes(), version.sha256(), version.status().name(), version.createdBy(),
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
            VERSION, tenantId, versionId, userId
        ));
    }

    private static <T> Optional<T> one(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }
}
