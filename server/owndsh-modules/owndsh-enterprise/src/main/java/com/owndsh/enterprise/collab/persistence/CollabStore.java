/**
 * [INPUT]: 项目、成员与消息的不可变事实与应用层已校验的写入命令。
 * [OUTPUT]: 提供项目 CRUD 端口、成员治理、消息幂等插入与 keyset/seq 列表。
 * [POS]: collab application 的 DIP 持久化边界；所有查询限定 tenant。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CollabStore {
    record ProjectRow(
        long id,
        String tenantId,
        String name,
        long ownerUserId,
        String status,
        Instant createdAt,
        Instant updatedAt
    ) {
    }

    record MemberRow(long projectId, long userId, String role, Instant joinedAt) {
    }

    record MessageRow(
        long id,
        String tenantId,
        long projectId,
        long serverSeq,
        long authorUserId,
        String kind,
        String body,
        String targetSessionId,
        Long targetSeq,
        String idempotencyKey,
        Instant createdAt
    ) {
    }

    boolean insertProject(long id, String tenantId, String name, long ownerUserId, Instant now);

    Optional<ProjectRow> findProject(String tenantId, long projectId);

    Optional<ProjectRow> findProjectForUpdate(String tenantId, long projectId);

    Optional<MemberRow> findMember(String tenantId, long projectId, long userId);

    boolean insertMember(String tenantId, long projectId, long userId, String role, Instant now);

    boolean updateMemberRole(String tenantId, long projectId, long userId, String role);

    boolean deleteMember(String tenantId, long projectId, long userId);

    boolean updateProjectOwner(String tenantId, long projectId, long ownerUserId, Instant now);

    List<ProjectRow> listProjectsForUser(String tenantId, long userId, long afterId, int limit);

    List<MemberRow> listMembers(String tenantId, long projectId);

    boolean userExists(String tenantId, long userId);

    Optional<MessageRow> findMessageByIdempotency(String tenantId, long projectId, String idempotencyKey);

    boolean insertMessage(MessageRow row);

    long nextServerSeq(String tenantId, long projectId);

    List<MessageRow> listMessages(String tenantId, long projectId, long afterSeq, int limit);
}
