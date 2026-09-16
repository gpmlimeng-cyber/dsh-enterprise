/**
 * [INPUT]: 依赖五类 PROJECT/COLLAB 审计 action 的非正文事实。
 * [OUTPUT]: 对外提供建项/加人/移出/转让/发消息的显式 metadata 白名单。
 * [POS]: collab 到 audit JSONB 的唯一 metadata 边界，禁止消息 body 进入审计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;

public sealed interface CollabAuditMetadata extends AuditMetadata permits
    CollabAuditMetadata.ProjectCreated,
    CollabAuditMetadata.MemberAdded,
    CollabAuditMetadata.MemberRemoved,
    CollabAuditMetadata.OwnerTransferred,
    CollabAuditMetadata.MessagePosted {

    record ProjectCreated(long projectId, String name) implements CollabAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PROJECT_CREATED;
        }
    }

    record MemberAdded(long projectId, long userId, String role) implements CollabAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PROJECT_MEMBER_ADDED;
        }
    }

    record MemberRemoved(long projectId, long userId) implements CollabAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PROJECT_MEMBER_REMOVED;
        }
    }

    record OwnerTransferred(long projectId, long fromUserId, long toUserId)
        implements CollabAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PROJECT_OWNER_TRANSFERRED;
        }
    }

    record MessagePosted(long projectId, long messageId, long serverSeq, String kind, boolean hasTarget)
        implements CollabAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.COLLAB_MESSAGE_POSTED;
        }
    }
}
