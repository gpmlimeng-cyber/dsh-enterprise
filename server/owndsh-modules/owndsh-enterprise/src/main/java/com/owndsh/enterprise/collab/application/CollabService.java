/**
 * [INPUT]: 依赖 CollabStore、AuditSink、雪花 ID、EnterpriseCollabProperties 与 DeviceCallContext。
 * [OUTPUT]: 提供项目建/列/详、邀请/移出/转让与消息幂等发送/列表的短事务用例。
 * [POS]: collab 模块应用编排；成员关系即 ACL，不读取 Session 正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.collab.domain.CollabMessageKind;
import com.owndsh.enterprise.collab.domain.ProjectMemberRole;
import com.owndsh.enterprise.collab.persistence.CollabStore;
import com.owndsh.enterprise.collab.persistence.CollabStore.MemberRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.MessageRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.ProjectRow;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.function.LongSupplier;

public final class CollabService {
    private final TransactionTemplate tx;
    private final CollabStore store;
    private final AuditSink audit;
    private final LongSupplier ids;
    private final boolean enabled;

    public CollabService(
        PlatformTransactionManager transactionManager,
        CollabStore store,
        AuditSink audit,
        LongSupplier ids,
        boolean enabled
    ) {
        this.tx = new TransactionTemplate(transactionManager);
        this.store = store;
        this.audit = audit;
        this.ids = ids;
        this.enabled = enabled;
    }

    public ProjectRow createProject(DeviceCallContext context, String name) {
        requireEnabled();
        String trimmed = requireName(name);
        long projectId = ids.getAsLong();
        long actor = actorId(context);
        Instant now = Instant.now();
        return tx.execute(status -> {
            try {
                if (!store.insertProject(projectId, context.tenantId(), trimmed, actor, now)) {
                    throw new CollabException(CollabException.Kind.INVALID);
                }
            } catch (DuplicateKeyException ex) {
                throw new CollabException(CollabException.Kind.INVALID);
            }
            store.insertMember(context.tenantId(), projectId, actor, ProjectMemberRole.OWNER.name(), now);
            audit.append(event(
                context, AuditAction.PROJECT_CREATED, projectId,
                new CollabAuditMetadata.ProjectCreated(projectId, trimmed)
            ));
            return store.findProject(context.tenantId(), projectId).orElseThrow();
        });
    }

    public List<ProjectRow> listProjects(DeviceCallContext context, long afterId, int limit) {
        requireEnabled();
        return store.listProjectsForUser(context.tenantId(), actorId(context), afterId, limit);
    }

    public ProjectDetail getProject(DeviceCallContext context, long projectId) {
        requireEnabled();
        long actor = actorId(context);
        ProjectRow project = requireMemberProject(context, projectId, actor);
        List<MemberRow> members = store.listMembers(context.tenantId(), projectId);
        return new ProjectDetail(project, members);
    }

    public MemberRow addMember(DeviceCallContext context, long projectId, long userId) {
        requireEnabled();
        long actor = actorId(context);
        return tx.execute(status -> {
            requireOwner(context, projectId, actor);
            if (!store.userExists(context.tenantId(), userId)) {
                throw new CollabException(CollabException.Kind.MEMBER_NOT_FOUND);
            }
            if (store.findMember(context.tenantId(), projectId, userId).isPresent()) {
                throw new CollabException(CollabException.Kind.MEMBER_EXISTS);
            }
            Instant now = Instant.now();
            store.insertMember(context.tenantId(), projectId, userId, ProjectMemberRole.MEMBER.name(), now);
            audit.append(event(
                context, AuditAction.PROJECT_MEMBER_ADDED, projectId,
                new CollabAuditMetadata.MemberAdded(projectId, userId, ProjectMemberRole.MEMBER.name())
            ));
            appendSystem(context, projectId, "成员 " + userId + " 已加入项目");
            return store.findMember(context.tenantId(), projectId, userId).orElseThrow();
        });
    }

    public void removeMember(DeviceCallContext context, long projectId, long userId) {
        requireEnabled();
        long actor = actorId(context);
        tx.executeWithoutResult(status -> {
            ProjectRow project = requireOwner(context, projectId, actor);
            if (project.ownerUserId() == userId) {
                throw new CollabException(CollabException.Kind.LAST_OWNER);
            }
            MemberRow member = store.findMember(context.tenantId(), projectId, userId)
                .orElseThrow(() -> new CollabException(CollabException.Kind.MEMBER_NOT_FOUND));
            if (!store.deleteMember(context.tenantId(), projectId, member.userId())) {
                throw new CollabException(CollabException.Kind.MEMBER_NOT_FOUND);
            }
            audit.append(event(
                context, AuditAction.PROJECT_MEMBER_REMOVED, projectId,
                new CollabAuditMetadata.MemberRemoved(projectId, userId)
            ));
            appendSystem(context, projectId, "成员 " + userId + " 已移出项目");
        });
    }

    public ProjectRow transferOwner(DeviceCallContext context, long projectId, long userId) {
        requireEnabled();
        long actor = actorId(context);
        return tx.execute(status -> {
            ProjectRow project = requireOwner(context, projectId, actor);
            if (project.ownerUserId() == userId) {
                throw new CollabException(CollabException.Kind.LAST_OWNER);
            }
            MemberRow target = store.findMember(context.tenantId(), projectId, userId)
                .orElseThrow(() -> new CollabException(CollabException.Kind.MEMBER_NOT_FOUND));
            Instant now = Instant.now();
            store.updateMemberRole(context.tenantId(), projectId, actor, ProjectMemberRole.MEMBER.name());
            store.updateMemberRole(
                context.tenantId(), projectId, target.userId(), ProjectMemberRole.OWNER.name()
            );
            store.updateProjectOwner(context.tenantId(), projectId, target.userId(), now);
            audit.append(event(
                context, AuditAction.PROJECT_OWNER_TRANSFERRED, projectId,
                new CollabAuditMetadata.OwnerTransferred(projectId, actor, target.userId())
            ));
            appendSystem(context, projectId, "群主已转让给成员 " + target.userId());
            return store.findProject(context.tenantId(), projectId).orElseThrow();
        });
    }

    public MessageRow postMessage(
        DeviceCallContext context,
        long projectId,
        String idempotencyKey,
        String kindRaw,
        String body,
        String targetSessionId,
        Long targetSeq
    ) {
        requireEnabled();
        long actor = actorId(context);
        String idem = requireIdempotencyKey(idempotencyKey);
        CollabMessageKind kind = parseClientKind(kindRaw);
        String trimmedBody = requireBody(body);
        String target = requireTarget(kind, targetSessionId);
        if (targetSeq != null && targetSeq < 0) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return tx.execute(status -> {
            store.findProjectForUpdate(context.tenantId(), projectId)
                .orElseThrow(() -> new CollabException(CollabException.Kind.PROJECT_NOT_FOUND));
            if (store.findMember(context.tenantId(), projectId, actor).isEmpty()) {
                throw new CollabException(CollabException.Kind.PROJECT_NOT_FOUND);
            }
            MessageRow existing = store.findMessageByIdempotency(context.tenantId(), projectId, idem)
                .orElse(null);
            if (existing != null) {
                return existing;
            }
            long seq = store.nextServerSeq(context.tenantId(), projectId);
            MessageRow row = new MessageRow(
                ids.getAsLong(),
                context.tenantId(),
                projectId,
                seq,
                actor,
                kind.name(),
                trimmedBody,
                target,
                targetSeq,
                idem,
                Instant.now()
            );
            try {
                if (!store.insertMessage(row)) {
                    throw new CollabException(CollabException.Kind.INVALID);
                }
            } catch (DuplicateKeyException ex) {
                return store.findMessageByIdempotency(context.tenantId(), projectId, idem)
                    .orElseThrow(() -> new CollabException(CollabException.Kind.INVALID));
            }
            audit.append(event(
                context, AuditAction.COLLAB_MESSAGE_POSTED, projectId,
                new CollabAuditMetadata.MessagePosted(projectId, row.id(), seq, kind.name(), target != null)
            ));
            return row;
        });
    }

    public List<MessageRow> listMessages(DeviceCallContext context, long projectId, long afterSeq, int limit) {
        requireEnabled();
        requireMember(context, projectId, actorId(context));
        return store.listMessages(context.tenantId(), projectId, afterSeq, limit);
    }

    private void requireEnabled() {
        if (!enabled) {
            throw new CollabException(CollabException.Kind.DISABLED);
        }
    }

    private static long actorId(DeviceCallContext context) {
        return context.session().userId();
    }

    private ProjectRow requireMemberProject(DeviceCallContext context, long projectId, long userId) {
        ProjectRow project = store.findProject(context.tenantId(), projectId)
            .orElseThrow(() -> new CollabException(CollabException.Kind.PROJECT_NOT_FOUND));
        if (store.findMember(context.tenantId(), projectId, userId).isEmpty()) {
            throw new CollabException(CollabException.Kind.PROJECT_NOT_FOUND);
        }
        return project;
    }

    private void requireMember(DeviceCallContext context, long projectId, long userId) {
        requireMemberProject(context, projectId, userId);
    }

    private ProjectRow requireOwner(DeviceCallContext context, long projectId, long userId) {
        ProjectRow project = store.findProjectForUpdate(context.tenantId(), projectId)
            .orElseThrow(() -> new CollabException(CollabException.Kind.PROJECT_NOT_FOUND));
        MemberRow member = store.findMember(context.tenantId(), projectId, userId)
            .orElseThrow(() -> new CollabException(CollabException.Kind.PROJECT_NOT_FOUND));
        if (project.ownerUserId() != userId || !ProjectMemberRole.OWNER.name().equals(member.role())) {
            throw new CollabException(CollabException.Kind.NOT_OWNER);
        }
        return project;
    }

    private void appendSystem(DeviceCallContext context, long projectId, String body) {
        long seq = store.nextServerSeq(context.tenantId(), projectId);
        MessageRow row = new MessageRow(
            ids.getAsLong(),
            context.tenantId(),
            projectId,
            seq,
            actorId(context),
            CollabMessageKind.SYSTEM.name(),
            body,
            null,
            null,
            "sys:" + context.requestId() + ":" + seq,
            Instant.now()
        );
        try {
            if (!store.insertMessage(row)) {
                throw new CollabException(CollabException.Kind.INVALID);
            }
        } catch (DuplicateKeyException ex) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        audit.append(event(
            context, AuditAction.COLLAB_MESSAGE_POSTED, projectId,
            new CollabAuditMetadata.MessagePosted(
                projectId, row.id(), seq, CollabMessageKind.SYSTEM.name(), false
            )
        ));
    }

    private AuditEvent event(
        DeviceCallContext context,
        AuditAction action,
        long projectId,
        CollabAuditMetadata metadata
    ) {
        long id = ids.getAsLong();
        if (id <= 0) {
            throw new IllegalStateException("ID generator 返回非正数");
        }
        return new AuditEvent(
            id,
            context.tenantId(),
            Instant.now(),
            AuditActorType.USER,
            context.session().userId(),
            null,
            action,
            "PROJECT",
            Long.toString(projectId),
            AuditResult.SUCCESS,
            null,
            context.requestId(),
            context.sourceIp(),
            context.userAgentHash(),
            metadata
        );
    }

    private static String requireName(String name) {
        if (name == null) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        String trimmed = name.trim();
        if (trimmed.isEmpty() || trimmed.length() > 128) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return trimmed;
    }

    private static String requireBody(String body) {
        if (body == null) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        String trimmed = body.trim();
        if (trimmed.isEmpty() || trimmed.length() > 4000) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return trimmed;
    }

    private static String requireIdempotencyKey(String key) {
        if (key == null || key.isBlank() || key.length() > 255) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return key.trim();
    }

    private static CollabMessageKind parseClientKind(String kindRaw) {
        if (kindRaw == null || kindRaw.isBlank()) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        String normalized = kindRaw.trim().toUpperCase(Locale.ROOT);
        CollabMessageKind kind;
        try {
            kind = CollabMessageKind.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        if (kind == CollabMessageKind.SYSTEM) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return kind;
    }

    private static String requireTarget(CollabMessageKind kind, String targetSessionId) {
        boolean needsTarget = kind == CollabMessageKind.MENTION || kind == CollabMessageKind.INJECT_REQUEST;
        if (needsTarget) {
            if (targetSessionId == null || targetSessionId.isBlank() || targetSessionId.length() > 128) {
                throw new CollabException(CollabException.Kind.INVALID);
            }
            return targetSessionId.trim();
        }
        if (targetSessionId != null && !targetSessionId.isBlank()) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        return null;
    }

    public record ProjectDetail(ProjectRow project, List<MemberRow> members) {
    }
}
