/**
 * [INPUT]: 依赖 JdbcTemplate 与 V31 ent_project/ent_project_member/ent_collab_message。
 * [OUTPUT]: 实现 CollabStore 的 PostgreSQL adapter；成员存在性用 sys_user 限定 tenant。
 * [POS]: collab/persistence 的唯一 SQL 边界；不提供绕过 tenant 的任意查询。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public final class JdbcCollabStore implements CollabStore {
    private static final RowMapper<ProjectRow> PROJECT = (rs, i) -> new ProjectRow(
        rs.getLong("id"),
        rs.getString("tenant_id"),
        rs.getString("name"),
        rs.getLong("owner_user_id"),
        rs.getString("status"),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("updated_at").toInstant()
    );

    private static final RowMapper<MemberRow> MEMBER = (rs, i) -> new MemberRow(
        rs.getLong("project_id"),
        rs.getLong("user_id"),
        rs.getString("role"),
        rs.getTimestamp("joined_at").toInstant()
    );

    private static final RowMapper<MessageRow> MESSAGE = (rs, i) -> {
        long targetSeq = rs.getLong("target_seq");
        boolean targetSeqNull = rs.wasNull();
        return new MessageRow(
            rs.getLong("id"),
            rs.getString("tenant_id"),
            rs.getLong("project_id"),
            rs.getLong("server_seq"),
            rs.getLong("author_user_id"),
            rs.getString("kind"),
            rs.getString("body"),
            rs.getString("target_session_id"),
            targetSeqNull ? null : targetSeq,
            rs.getString("idempotency_key"),
            rs.getTimestamp("created_at").toInstant()
        );
    };

    private final JdbcTemplate jdbc;

    public JdbcCollabStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean insertProject(long id, String tenantId, String name, long ownerUserId, Instant now) {
        return jdbc.update(
            "insert into ent_project (id, tenant_id, name, owner_user_id, status, created_at, updated_at) "
                + "values (?, ?, ?, ?, 'ACTIVE', ?, ?)",
            id, tenantId, name.trim(), ownerUserId, now, now
        ) == 1;
    }

    @Override
    public Optional<ProjectRow> findProject(String tenantId, long projectId) {
        return jdbc.query(
            "select id, tenant_id, name, owner_user_id, status, created_at, updated_at "
                + "from ent_project where tenant_id = ? and id = ? and status = 'ACTIVE'",
            PROJECT, tenantId, projectId
        ).stream().findFirst();
    }

    @Override
    public Optional<ProjectRow> findProjectForUpdate(String tenantId, long projectId) {
        return jdbc.query(
            "select id, tenant_id, name, owner_user_id, status, created_at, updated_at "
                + "from ent_project where tenant_id = ? and id = ? and status = 'ACTIVE' for update",
            PROJECT, tenantId, projectId
        ).stream().findFirst();
    }

    @Override
    public Optional<MemberRow> findMember(String tenantId, long projectId, long userId) {
        return jdbc.query(
            "select project_id, user_id, role, joined_at from ent_project_member "
                + "where tenant_id = ? and project_id = ? and user_id = ?",
            MEMBER, tenantId, projectId, userId
        ).stream().findFirst();
    }

    @Override
    public boolean insertMember(String tenantId, long projectId, long userId, String role, Instant now) {
        return jdbc.update(
            "insert into ent_project_member (project_id, user_id, tenant_id, role, joined_at) "
                + "values (?, ?, ?, ?, ?)",
            projectId, userId, tenantId, role, now
        ) == 1;
    }

    @Override
    public boolean updateMemberRole(String tenantId, long projectId, long userId, String role) {
        return jdbc.update(
            "update ent_project_member set role = ? where tenant_id = ? and project_id = ? and user_id = ?",
            role, tenantId, projectId, userId
        ) == 1;
    }

    @Override
    public boolean deleteMember(String tenantId, long projectId, long userId) {
        return jdbc.update(
            "delete from ent_project_member where tenant_id = ? and project_id = ? and user_id = ?",
            tenantId, projectId, userId
        ) == 1;
    }

    @Override
    public boolean updateProjectOwner(String tenantId, long projectId, long ownerUserId, Instant now) {
        return jdbc.update(
            "update ent_project set owner_user_id = ?, updated_at = ? where tenant_id = ? and id = ? and status = 'ACTIVE'",
            ownerUserId, now, tenantId, projectId
        ) == 1;
    }

    @Override
    public List<ProjectRow> listProjectsForUser(String tenantId, long userId, long afterId, int limit) {
        return jdbc.query(
            "select p.id, p.tenant_id, p.name, p.owner_user_id, p.status, p.created_at, p.updated_at "
                + "from ent_project p join ent_project_member m on m.project_id = p.id "
                + "where p.tenant_id = ? and m.user_id = ? and p.status = 'ACTIVE' and p.id > ? "
                + "order by p.id asc limit ?",
            PROJECT, tenantId, userId, afterId, limit
        );
    }

    @Override
    public List<MemberRow> listMembers(String tenantId, long projectId) {
        return jdbc.query(
            "select project_id, user_id, role, joined_at from ent_project_member "
                + "where tenant_id = ? and project_id = ? order by role desc, user_id asc",
            MEMBER, tenantId, projectId
        );
    }

    @Override
    public boolean userExists(String tenantId, long userId) {
        Integer count = jdbc.queryForObject(
            "select count(*) from sys_user where user_id = ? and del_flag = '0'",
            Integer.class, userId
        );
        return count != null && count > 0;
    }

    @Override
    public Optional<MessageRow> findMessageByIdempotency(
        String tenantId, long projectId, String idempotencyKey
    ) {
        return jdbc.query(
            "select id, tenant_id, project_id, server_seq, author_user_id, kind, body, "
                + "target_session_id, target_seq, idempotency_key, created_at "
                + "from ent_collab_message where tenant_id = ? and project_id = ? and idempotency_key = ?",
            MESSAGE, tenantId, projectId, idempotencyKey
        ).stream().findFirst();
    }

    @Override
    public boolean insertMessage(MessageRow row) {
        return jdbc.update(
            "insert into ent_collab_message (id, tenant_id, project_id, server_seq, author_user_id, kind, body, "
                + "target_session_id, target_seq, idempotency_key, created_at) "
                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            row.id(), row.tenantId(), row.projectId(), row.serverSeq(), row.authorUserId(), row.kind(),
            row.body(), row.targetSessionId(), row.targetSeq(), row.idempotencyKey(), row.createdAt()
        ) == 1;
    }

    @Override
    public long nextServerSeq(String tenantId, long projectId) {
        Long max = jdbc.queryForObject(
            "select coalesce(max(server_seq), -1) from ent_collab_message where tenant_id = ? and project_id = ?",
            Long.class, tenantId, projectId
        );
        return (max == null ? -1L : max) + 1L;
    }

    @Override
    public List<MessageRow> listMessages(String tenantId, long projectId, long afterSeq, int limit) {
        return jdbc.query(
            "select id, tenant_id, project_id, server_seq, author_user_id, kind, body, "
                + "target_session_id, target_seq, idempotency_key, created_at "
                + "from ent_collab_message where tenant_id = ? and project_id = ? and server_seq > ? "
                + "order by server_seq asc limit ?",
            MESSAGE, tenantId, projectId, afterSeq, limit
        );
    }
}
