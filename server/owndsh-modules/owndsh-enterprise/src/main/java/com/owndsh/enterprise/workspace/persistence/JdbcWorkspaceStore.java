/**
 * [INPUT]: 依赖 JdbcOperations 与 V31 ent_cloud_project / ent_cloud_project_member 表。
 * [OUTPUT]: 实现 slug 唯一、tenant 限定查询、成员增删与 OWNER 计数。
 * [POS]: workspace/persistence 的 PostgreSQL adapter，所有查询同时限定 tenant。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.persistence;

import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public final class JdbcWorkspaceStore implements WorkspaceStore {
    private static final RowMapper<CloudProject> PROJECT_ROW = (resultSet, rowNum) -> mapProject(resultSet);
    private static final RowMapper<CloudProjectMember> MEMBER_ROW =
        (resultSet, rowNum) -> mapMember(resultSet);

    private final JdbcOperations jdbc;

    public JdbcWorkspaceStore(JdbcOperations jdbc) {
        this.jdbc = java.util.Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public boolean slugExists(String tenantId, String slug) {
        Integer count = jdbc.queryForObject(
            "select count(*) from ent_cloud_project where tenant_id=? and slug=?",
            Integer.class, tenantId, slug
        );
        return count != null && count > 0;
    }

    @Override
    public void insert(CloudProject project) {
        try {
            jdbc.update(
                """
                insert into ent_cloud_project(
                    id,tenant_id,slug,name,description,default_branch,created_by,status,created_at,updated_at
                ) values (?,?,?,?,?,?,?,?,?,?)
                """,
                project.id(), project.tenantId(), project.slug(), project.name(), project.description(),
                project.defaultBranch(), project.createdBy(), project.status().name(),
                Timestamp.from(project.createdAt()), Timestamp.from(project.updatedAt())
            );
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("slug 冲突", exception);
        }
    }

    @Override
    public void insertMember(CloudProjectMember member) {
        jdbc.update(
            """
            insert into ent_cloud_project_member(project_id,user_id,role,created_at)
            values (?,?,?,?)
            on conflict (project_id,user_id) do nothing
            """,
            member.projectId(), member.userId(), member.role().name(), Timestamp.from(member.createdAt())
        );
    }

    @Override
    public Optional<CloudProject> findById(String tenantId, long projectId) {
        List<CloudProject> rows = jdbc.query(
            """
            select id,tenant_id,slug,name,description,default_branch,created_by,status,created_at,updated_at
            from ent_cloud_project where tenant_id=? and id=?
            """,
            PROJECT_ROW, tenantId, projectId
        );
        return rows.stream().findFirst();
    }

    @Override
    public Optional<CloudProjectMember> findMembership(String tenantId, long projectId, long userId) {
        List<CloudProjectMember> rows = jdbc.query(
            """
            select m.project_id,m.user_id,m.role,m.created_at
            from ent_cloud_project_member m
            join ent_cloud_project p on p.id=m.project_id and p.tenant_id=?
            where m.project_id=? and m.user_id=?
            """,
            MEMBER_ROW, tenantId, projectId, userId
        );
        return rows.stream().findFirst();
    }

    @Override
    public List<CloudProjectMember> listMembers(String tenantId, long projectId) {
        return jdbc.query(
            """
            select m.project_id,m.user_id,m.role,m.created_at
            from ent_cloud_project_member m
            join ent_cloud_project p on p.id=m.project_id and p.tenant_id=?
            where m.project_id=?
            order by m.user_id
            """,
            MEMBER_ROW, tenantId, projectId
        );
    }

    @Override
    public List<CloudProject> listByUser(String tenantId, long userId, long afterId, int limit) {
        return jdbc.query(
            """
            select p.id,p.tenant_id,p.slug,p.name,p.description,p.default_branch,p.created_by,p.status,
                   p.created_at,p.updated_at
            from ent_cloud_project p
            join ent_cloud_project_member m on m.project_id=p.id and m.user_id=?
            where p.tenant_id=? and p.status='ACTIVE' and p.id>?
            order by p.id
            limit ?
            """,
            PROJECT_ROW, userId, tenantId, afterId, limit
        );
    }

    @Override
    public int countOwners(String tenantId, long projectId) {
        Integer count = jdbc.queryForObject(
            """
            select count(*) from ent_cloud_project_member m
            join ent_cloud_project p on p.id=m.project_id and p.tenant_id=?
            where m.project_id=? and m.role='OWNER'
            """,
            Integer.class, tenantId, projectId
        );
        return count == null ? 0 : count;
    }

    @Override
    public int deleteMember(String tenantId, long projectId, long userId) {
        return jdbc.update(
            """
            delete from ent_cloud_project_member m
            using ent_cloud_project p
            where m.project_id=p.id and p.tenant_id=?
              and m.project_id=? and m.user_id=?
            """,
            tenantId, projectId, userId
        );
    }

    @Override
    public boolean userExists(long userId) {
        Integer count = jdbc.queryForObject(
            "select count(*) from sys_user where user_id=?",
            Integer.class, userId
        );
        return count != null && count > 0;
    }

    private static CloudProject mapProject(ResultSet resultSet) throws SQLException {
        return new CloudProject(
            resultSet.getLong("id"),
            resultSet.getString("tenant_id"),
            resultSet.getString("slug"),
            resultSet.getString("name"),
            resultSet.getString("description"),
            resultSet.getString("default_branch"),
            resultSet.getLong("created_by"),
            CloudProject.Status.valueOf(resultSet.getString("status")),
            toInstant(resultSet.getTimestamp("created_at")),
            toInstant(resultSet.getTimestamp("updated_at"))
        );
    }

    private static CloudProjectMember mapMember(ResultSet resultSet) throws SQLException {
        return new CloudProjectMember(
            resultSet.getLong("project_id"),
            resultSet.getLong("user_id"),
            CloudProjectMember.Role.valueOf(resultSet.getString("role")),
            toInstant(resultSet.getTimestamp("created_at"))
        );
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? Instant.EPOCH : timestamp.toInstant();
    }
}
