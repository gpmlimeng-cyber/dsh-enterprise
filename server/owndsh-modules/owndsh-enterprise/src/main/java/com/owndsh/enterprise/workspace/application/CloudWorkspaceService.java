/**
 * [INPUT]: 依赖事务、WorkspaceStore、GitRepositoryService、AuditSink、DeviceCallContext 与 properties。
 * [OUTPUT]: 对外提供创建/列表/详情/成员治理与 Git 授权解析，slug 规范化、非成员拒绝和创建失败补偿。
 * [POS]: workspace/application 的用例编排；不做 HTTP 序列化，不把仓库路径交给客户端。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditMetadata;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.audit.CloudProjectCreatedMetadata;
import com.owndsh.enterprise.audit.CloudProjectMemberAddedMetadata;
import com.owndsh.enterprise.audit.CloudProjectMemberRemovedMetadata;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.workspace.EnterpriseWorkspaceProperties;
import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;
import com.owndsh.enterprise.workspace.git.CloudWorkspaceGitException;
import com.owndsh.enterprise.workspace.git.GitRepositoryService;
import com.owndsh.enterprise.workspace.persistence.WorkspaceStore;
import org.springframework.transaction.support.TransactionOperations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.LongSupplier;
import java.util.regex.Pattern;

public final class CloudWorkspaceService {
    private static final Pattern NAME = Pattern.compile(".{1,120}");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9][a-z0-9-]{0,63}$");
    private static final String RESOURCE_TYPE = "CLOUD_PROJECT";

    private final TransactionOperations transactions;
    private final WorkspaceStore store;
    private final GitRepositoryService repositories;
    private final EnterpriseWorkspaceProperties properties;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public CloudWorkspaceService(
        TransactionOperations transactions,
        WorkspaceStore store,
        GitRepositoryService repositories,
        EnterpriseWorkspaceProperties properties,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, store, repositories, properties, auditSink, ids, Clock.systemUTC());
    }

    CloudWorkspaceService(
        TransactionOperations transactions,
        WorkspaceStore store,
        GitRepositoryService repositories,
        EnterpriseWorkspaceProperties properties,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.store = Objects.requireNonNull(store, "store");
        this.repositories = Objects.requireNonNull(repositories, "repositories");
        this.properties = Objects.requireNonNull(properties, "properties");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.DISABLED);
        }
    }

    /**
     * 先初始化 bare 仓库，再在同一事务写入项目行、OWNER 成员与审计；
     * 事务失败时删除刚建的仓库目录，保证「项目存在 ⟺ 仓库存在」且成功审计只随提交出现。
     */
    public CloudProject create(DeviceCallContext context, String name, String description) {
        requireEnabled();
        String trimmedName = name == null ? "" : name.trim();
        if (!NAME.matcher(trimmedName).matches()) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.INVALID_REQUEST, "name");
        }
        String slug = slugify(trimmedName);
        if (!SLUG.matcher(slug).matches()) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.INVALID_REQUEST, "slug");
        }
        String trimmedDescription = description == null || description.isBlank() ? null : description.trim();
        if (trimmedDescription != null && trimmedDescription.length() > 2000) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.INVALID_REQUEST, "description");
        }
        if (store.slugExists(context.tenantId(), slug)) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.SLUG_CONFLICT, slug);
        }
        Instant now = clock.instant();
        long id = positiveId();
        CloudProject project = new CloudProject(
            id, context.tenantId(), slug, trimmedName, trimmedDescription, "main",
            context.session().userId(), CloudProject.Status.ACTIVE, now, now
        );
        try {
            repositories.initBare(id, "main");
        } catch (CloudWorkspaceGitException exception) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.GIT_UNAVAILABLE);
        }
        try {
            transactions.executeWithoutResult(status -> {
                store.insert(project);
                store.insertMember(new CloudProjectMember(
                    id, context.session().userId(), CloudProjectMember.Role.OWNER, now
                ));
                auditSink.append(event(
                    context, id, AuditAction.CLOUD_PROJECT_CREATED,
                    new CloudProjectCreatedMetadata(slug, CloudProjectMember.Role.OWNER.name())
                ));
            });
        } catch (RuntimeException exception) {
            deleteBare(id);
            if (store.slugExists(context.tenantId(), slug)) {
                throw new CloudWorkspaceException(CloudWorkspaceException.Kind.SLUG_CONFLICT, slug);
            }
            throw exception;
        }
        return project;
    }

    private void deleteBare(long projectId) {
        Path path = repositories.barePath(projectId);
        if (!Files.isDirectory(path)) return;
        try (var walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(entry -> {
                try {
                    Files.deleteIfExists(entry);
                } catch (IOException ignored) {
                    // 目录残留由运维 GC 处理，优先保证数据库无半成品项目。
                }
            });
        } catch (IOException ignored) {
            // 目录残留由运维 GC 处理，优先保证数据库无半成品项目。
        }
    }

    public List<MemberProject> listMine(DeviceCallContext context) {
        requireEnabled();
        List<CloudProject> projects = store.listByUser(context.tenantId(), context.session().userId(), 0, 200);
        return projects.stream().map(project -> new MemberProject(
            project,
            store.findMembership(context.tenantId(), project.id(), context.session().userId())
                .map(CloudProjectMember::role)
                .orElse(CloudProjectMember.Role.MEMBER)
        )).toList();
    }

    public MemberProject get(DeviceCallContext context, long projectId) {
        requireEnabled();
        CloudProject project = requireMember(context, projectId);
        CloudProjectMember.Role role = store
            .findMembership(context.tenantId(), projectId, context.session().userId())
            .map(CloudProjectMember::role)
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN));
        return new MemberProject(project, role);
    }

    public CloudProject authorizeGit(String tenantId, long userId, long projectId) {
        requireEnabled();
        CloudProject project = store.findById(tenantId, projectId)
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.NOT_FOUND));
        if (project.status() != CloudProject.Status.ACTIVE) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN);
        }
        store.findMembership(tenantId, projectId, userId)
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN));
        return project;
    }

    public List<CloudProjectMember> listMembers(DeviceCallContext context, long projectId) {
        requireEnabled();
        requireMember(context, projectId);
        return store.listMembers(context.tenantId(), projectId);
    }

    public CloudProjectMember addMember(DeviceCallContext context, long projectId, long userId) {
        requireEnabled();
        requireOwner(context, projectId);
        if (userId <= 0 || !store.userExists(userId)) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.INVALID_REQUEST, "userId");
        }
        CloudProjectMember member = new CloudProjectMember(
            projectId, userId, CloudProjectMember.Role.MEMBER, clock.instant()
        );
        transactions.executeWithoutResult(status -> {
            store.insertMember(member);
            auditSink.append(event(
                context, projectId, AuditAction.CLOUD_PROJECT_MEMBER_ADDED,
                new CloudProjectMemberAddedMetadata(userId, CloudProjectMember.Role.MEMBER.name())
            ));
        });
        return store.findMembership(context.tenantId(), projectId, userId).orElse(member);
    }

    public void removeMember(DeviceCallContext context, long projectId, long userId) {
        requireEnabled();
        requireOwner(context, projectId);
        boolean isOwner = store.findMembership(context.tenantId(), projectId, userId)
            .map(member -> member.role() == CloudProjectMember.Role.OWNER)
            .orElse(false);
        if (isOwner && store.countOwners(context.tenantId(), projectId) <= 1) {
            throw new CloudWorkspaceException(CloudWorkspaceException.Kind.LAST_OWNER);
        }
        transactions.executeWithoutResult(status -> {
            int deleted = store.deleteMember(context.tenantId(), projectId, userId);
            if (deleted == 0) {
                throw new CloudWorkspaceException(CloudWorkspaceException.Kind.NOT_FOUND);
            }
            auditSink.append(event(
                context, projectId, AuditAction.CLOUD_PROJECT_MEMBER_REMOVED,
                new CloudProjectMemberRemovedMetadata(userId)
            ));
        });
    }

    private CloudProject requireMember(DeviceCallContext context, long projectId) {
        CloudProject project = store.findById(context.tenantId(), projectId)
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.NOT_FOUND));
        store.findMembership(context.tenantId(), projectId, context.session().userId())
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN));
        return project;
    }

    private CloudProject requireOwner(DeviceCallContext context, long projectId) {
        CloudProject project = requireMember(context, projectId);
        store.findMembership(context.tenantId(), projectId, context.session().userId())
            .filter(member -> member.role() == CloudProjectMember.Role.OWNER)
            .orElseThrow(() -> new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN));
        return project;
    }

    private AuditEvent event(
        DeviceCallContext context,
        long projectId,
        AuditAction action,
        AuditMetadata metadata
    ) {
        return new AuditEvent(
            positiveId(), context.tenantId(), Instant.now(clock), AuditActorType.USER,
            context.session().userId(), null, action, RESOURCE_TYPE, Long.toString(projectId),
            AuditResult.SUCCESS, null, context.requestId(), context.sourceIp(), context.userAgentHash(), metadata
        );
    }

    private long positiveId() {
        long value = ids.getAsLong();
        if (value <= 0) throw new IllegalStateException("ID generator 返回非正数");
        return value;
    }

    public static String slugify(String name) {
        String base = name.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-+|-+$)", "");
        if (base.length() > 64) {
            base = base.substring(0, 64);
        }
        base = base.replaceAll("-+$", "");
        if (base.isEmpty()) {
            base = "project";
        }
        return base;
    }

    public record MemberProject(CloudProject project, CloudProjectMember.Role role) {
    }
}
