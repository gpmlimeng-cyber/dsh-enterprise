/**
 * [INPUT]: 依赖 V35/V36/V37 表、Spring JDBC 与 Jackson（skills jsonb 序列化）。
 * [OUTPUT]: 实现 skill catalog/version/assignment/marks/category 与可见 runtime 查询（assignment 与 builtin 取并集）。
 * [POS]: skill/persistence 的 PostgreSQL adapter，USER 优先于 ALL；skills 列只承载 frontmatter 脱敏投影。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.persistence;

import com.owndsh.enterprise.skill.domain.RuntimeSkill;
import com.owndsh.enterprise.skill.domain.SkillAssignment;
import com.owndsh.enterprise.skill.domain.SkillEntry;
import com.owndsh.enterprise.skill.domain.SkillPackage;
import com.owndsh.enterprise.skill.domain.SkillVersion;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class JdbcSkillStore implements SkillStore {
    private static final TypeReference<List<SkillEntry>> ENTRIES = new TypeReference<>() {
    };

    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    public JdbcSkillStore(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    private final RowMapper<SkillPackage> packageMapper = (rs, i) -> new SkillPackage(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getString("skill_id"),
        rs.getString("display_name"), rs.getString("description"), rs.getString("category"),
        rs.getBoolean("builtin"), rs.getBoolean("featured"),
        SkillPackage.Status.valueOf(rs.getString("status")), rs.getLong("revision")
    );

    private final RowMapper<SkillVersion> versionMapper = (rs, i) -> new SkillVersion(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("package_id"),
        rs.getString("package_skill_id"), rs.getString("source_dsh_version"), rs.getString("artifact_ref"),
        rs.getLong("size_bytes"), rs.getString("sha256"),
        SkillVersion.Status.valueOf(rs.getString("status")), rs.getInt("skill_count"),
        entries(rs.getString("skills")), rs.getLong("created_by"),
        rs.getTimestamp("created_at").toInstant(), rs.getLong("revision")
    );

    private static final RowMapper<SkillAssignment> ASSIGNMENT = (rs, i) -> new SkillAssignment(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("package_id"),
        SkillAssignment.SubjectType.valueOf(rs.getString("subject_type")),
        (Long) rs.getObject("subject_id"),
        SkillAssignment.Status.valueOf(rs.getString("status")), rs.getLong("revision")
    );

    /**
     * runtime 查询不直接复用 versionMapper：它按包取最新 PUBLISHED 版本，
     * 列名来自 join 别名，且必须保持与可见性裁决同一条件。
     */
    private final RowMapper<RuntimeSkill> runtimeMapper = (rs, i) -> new RuntimeSkill(
        rs.getLong("package_id"), rs.getString("skill_id"), rs.getString("display_name"),
        rs.getString("description"), rs.getString("category"), rs.getBoolean("builtin"),
        rs.getLong("version_id"), rs.getString("source_dsh_version"),
        rs.getLong("size_bytes"), rs.getString("sha256"), entries(rs.getString("skills")),
        rs.getTimestamp("updated_at").toInstant()
    );

    private List<SkillEntry> entries(String value) {
        if (value == null || value.isBlank()) return List.of();
        return json.readValue(value, ENTRIES);
    }

    @Override
    public Optional<SkillPackage> findPackageBySkillIdForUpdate(String tenantId, String skillId) {
        return one(jdbc.query(
            "select * from ent_skill_package where tenant_id = ? and skill_id = ? for update",
            packageMapper, tenantId, skillId
        ));
    }

    @Override
    public Optional<SkillPackage> findPackageById(String tenantId, long packageId) {
        return one(jdbc.query(
            "select * from ent_skill_package where tenant_id = ? and id = ?", packageMapper, tenantId, packageId
        ));
    }

    @Override
    public Optional<SkillPackage> findPackageByIdForUpdate(String tenantId, long packageId) {
        return one(jdbc.query(
            "select * from ent_skill_package where tenant_id = ? and id = ? for update",
            packageMapper, tenantId, packageId
        ));
    }

    @Override
    public List<SkillPackage> listPackages(String tenantId, long afterId, int limit) {
        return jdbc.query(
            "select * from ent_skill_package where tenant_id = ? and id > ? order by id asc limit ?",
            packageMapper, tenantId, afterId, limit
        );
    }

    @Override
    public void insertPackage(SkillPackage skillPackage) {
        jdbc.update(
            """
            insert into ent_skill_package
            (id, tenant_id, skill_id, display_name, description, category, builtin, featured, status, revision)
            values (?,?,?,?,?,?,?,?,?,?)
            """,
            skillPackage.id(), skillPackage.tenantId(), skillPackage.skillId(), skillPackage.displayName(),
            skillPackage.description(), skillPackage.category(), skillPackage.builtin(), skillPackage.featured(),
            skillPackage.status().name(), skillPackage.revision()
        );
    }

    @Override
    public boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision) {
        return jdbc.update(
            "update ent_skill_package set revision = revision + 1 where tenant_id = ? and id = ? and revision = ?",
            tenantId, packageId, expectedRevision
        ) == 1;
    }

    @Override
    public boolean updatePackageMarks(
        String tenantId,
        long packageId,
        boolean builtin,
        boolean featured,
        long expectedRevision
    ) {
        return jdbc.update(
            """
            update ent_skill_package
            set builtin = ?, featured = ?, revision = revision + 1
            where tenant_id = ? and id = ? and revision = ?
            """,
            builtin, featured, tenantId, packageId, expectedRevision
        ) == 1;
    }

    @Override
    public boolean updatePackageCategory(
        String tenantId,
        long packageId,
        String category,
        long expectedRevision
    ) {
        return jdbc.update(
            """
            update ent_skill_package
            set category = ?, revision = revision + 1
            where tenant_id = ? and id = ? and revision = ?
            """,
            category, tenantId, packageId, expectedRevision
        ) == 1;
    }

    @Override
    public Optional<SkillVersion> findExistingVersion(
        String tenantId, String skillId, String sourceDshVersion, String sha256
    ) {
        return one(jdbc.query(
            """
            select v.*, p.skill_id as package_skill_id from ent_skill_version v
            join ent_skill_package p on p.id = v.package_id
            where v.tenant_id = ? and p.skill_id = ? and v.source_dsh_version = ? and v.sha256 = ?
            """,
            versionMapper, tenantId, skillId, sourceDshVersion, sha256
        ));
    }

    @Override
    public Optional<SkillVersion> findVersion(String tenantId, long versionId) {
        return one(jdbc.query(
            """
            select v.*, p.skill_id as package_skill_id from ent_skill_version v
            join ent_skill_package p on p.id = v.package_id
            where v.tenant_id = ? and v.id = ?
            """, versionMapper, tenantId, versionId
        ));
    }

    @Override
    public List<SkillVersion> listVersions(String tenantId, long packageId) {
        return jdbc.query(
            """
            select v.*, p.skill_id as package_skill_id from ent_skill_version v
            join ent_skill_package p on p.id = v.package_id
            where v.tenant_id = ? and v.package_id = ? order by v.created_at desc, v.id desc
            """,
            versionMapper, tenantId, packageId
        );
    }

    @Override
    public void insertVersion(SkillVersion version) {
        jdbc.update(
            """
            insert into ent_skill_version
            (id, tenant_id, package_id, source_dsh_version, artifact_ref, size_bytes, sha256, status,
             skill_count, skills, created_by, created_at, revision)
            values (?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?)
            """,
            version.id(), version.tenantId(), version.packageId(), version.sourceDshVersion(), version.artifactRef(),
            version.sizeBytes(), version.sha256(), version.status().name(), version.skillCount(),
            json.writeValueAsString(version.skills()), version.createdBy(),
            java.sql.Timestamp.from(version.createdAt()), version.revision()
        );
    }

    @Override
    public boolean transitionVersion(
        String tenantId, long versionId, SkillVersion.Status from, SkillVersion.Status to, long expectedRevision
    ) {
        int updated = expectedRevision == 0
            ? jdbc.update(
                "update ent_skill_version set status = ?, revision = revision + 1 where tenant_id = ? and id = ? and status = ? and revision = 0",
                to.name(), tenantId, versionId, from.name()
            )
            : jdbc.update(
                "update ent_skill_version set status = ?, revision = revision + 1 where tenant_id = ? and id = ? and status = ? and revision = ?",
                to.name(), tenantId, versionId, from.name(), expectedRevision
            );
        return updated == 1;
    }

    @Override
    public List<SkillAssignment> listAssignments(String tenantId, long packageId) {
        return jdbc.query(
            "select * from ent_skill_assignment where tenant_id = ? and package_id = ? order by id asc",
            ASSIGNMENT, tenantId, packageId
        );
    }

    @Override
    public void deleteAssignments(String tenantId, long packageId) {
        jdbc.update("delete from ent_skill_assignment where tenant_id = ? and package_id = ?", tenantId, packageId);
    }

    @Override
    public void insertAssignment(SkillAssignment assignment) {
        jdbc.update(
            "insert into ent_skill_assignment (id, tenant_id, package_id, subject_type, subject_id, status, revision) values (?,?,?,?,?,?,?)",
            assignment.id(), assignment.tenantId(), assignment.packageId(), assignment.subjectType().name(),
            assignment.subjectId(), assignment.status().name(), assignment.revision()
        );
    }

    @Override
    public boolean subjectExists(SkillAssignment.SubjectType subjectType, long subjectId) {
        if (subjectType == SkillAssignment.SubjectType.ALL) return true;
        Integer count = jdbc.queryForObject(
            "select count(*) from sys_user where user_id = ?", Integer.class, subjectId
        );
        return count != null && count > 0;
    }

    @Override
    public List<RuntimeSkill> findVisiblePublished(String tenantId, long userId) {
        return jdbc.query(
            """
            select p.id as package_id, p.skill_id, p.display_name, p.description, p.category, p.builtin,
                   v.id as version_id, v.source_dsh_version, v.size_bytes, v.sha256, v.skills,
                   v.created_at as updated_at
            from ent_skill_package p
            join ent_skill_version v on v.id = (
                select v2.id from ent_skill_version v2
                where v2.package_id = p.id and v2.status = 'PUBLISHED'
                order by v2.created_at desc, v2.id desc limit 1
            )
            where p.tenant_id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
              and (
                p.builtin
                or exists (
                  select 1 from ent_skill_assignment a
                  where a.package_id = p.id and a.status = 'ACTIVE'
                    and (
                      (a.subject_type = 'ALL' and a.subject_id is null)
                      or (a.subject_type = 'USER' and a.subject_id = ?)
                    )
                )
              )
            order by v.created_at desc, p.id desc
            """,
            runtimeMapper, tenantId, userId
        );
    }

    @Override
    public Optional<RuntimeSkill> findVisiblePublishedById(String tenantId, long userId, long packageId) {
        return one(jdbc.query(
            """
            select p.id as package_id, p.skill_id, p.display_name, p.description, p.category, p.builtin,
                   v.id as version_id, v.source_dsh_version, v.size_bytes, v.sha256, v.skills,
                   v.created_at as updated_at
            from ent_skill_package p
            join ent_skill_version v on v.id = (
                select v2.id from ent_skill_version v2
                where v2.package_id = p.id and v2.status = 'PUBLISHED'
                order by v2.created_at desc, v2.id desc limit 1
            )
            where p.tenant_id = ? and p.id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
              and (
                p.builtin
                or exists (
                  select 1 from ent_skill_assignment a
                  where a.package_id = p.id and a.status = 'ACTIVE'
                    and (
                      (a.subject_type = 'ALL' and a.subject_id is null)
                      or (a.subject_type = 'USER' and a.subject_id = ?)
                    )
                )
              )
            """,
            runtimeMapper, tenantId, packageId, userId
        ));
    }

    @Override
    public Optional<SkillVersion> findPublishedVersionForUser(String tenantId, long userId, long versionId) {
        return one(jdbc.query(
            """
            select v.*, p.skill_id as package_skill_id from ent_skill_version v
            join ent_skill_package p on p.id = v.package_id
            where v.tenant_id = ? and v.id = ? and v.status = 'PUBLISHED' and p.status = 'ACTIVE'
              and (
                p.builtin
                or exists (
                  select 1 from ent_skill_assignment a
                  where a.package_id = p.id and a.status = 'ACTIVE'
                    and (
                      (a.subject_type = 'ALL' and a.subject_id is null)
                      or (a.subject_type = 'USER' and a.subject_id = ?)
                    )
                )
              )
            """,
            versionMapper, tenantId, versionId, userId
        ));
    }

    private static <T> Optional<T> one(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }
}
