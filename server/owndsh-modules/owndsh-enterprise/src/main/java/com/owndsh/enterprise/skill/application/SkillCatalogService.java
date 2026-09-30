/**
 * [INPUT]: 依赖事务、SkillStore、ZIP inspector/CAS store、revision、审计与 ID。
 * [OUTPUT]: 提供技能目录、幂等上传（含包内多技能条目）、发布/退休与可见范围原子替换。
 * [POS]: skill/application 的管理状态编排，文件系统补偿与数据库事务在此协调。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import com.owndsh.enterprise.skill.artifact.SkillArtifactInspector;
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.domain.SkillAssignment;
import com.owndsh.enterprise.skill.domain.SkillPackage;
import com.owndsh.enterprise.skill.domain.SkillVersion;
import com.owndsh.enterprise.skill.persistence.SkillStore;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;

public final class SkillCatalogService {
    private final TransactionOperations transactions;
    private final SkillStore skills;
    private final SkillArtifactStore artifacts;
    private final SkillArtifactInspector inspector;
    private final BootstrapRevisionStore revisions;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public SkillCatalogService(
        TransactionOperations transactions,
        SkillStore skills,
        SkillArtifactStore artifacts,
        SkillArtifactInspector inspector,
        BootstrapRevisionStore revisions,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, skills, artifacts, inspector, revisions, auditSink, ids, Clock.systemUTC());
    }

    SkillCatalogService(
        TransactionOperations transactions,
        SkillStore skills,
        SkillArtifactStore artifacts,
        SkillArtifactInspector inspector,
        BootstrapRevisionStore revisions,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.skills = Objects.requireNonNull(skills, "skills");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.revisions = Objects.requireNonNull(revisions, "revisions");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<CatalogItem> list(String tenantId, long afterId, int limit) {
        return skills.listPackages(tenantId, afterId, limit).stream()
            .map(value -> new CatalogItem(
                value,
                skills.listVersions(tenantId, value.id()),
                skills.listAssignments(tenantId, value.id())
            ))
            .toList();
    }

    public UploadResult upload(
        SkillMutationContext context,
        UUID uploadId,
        InputStream input,
        SkillDisplayOverride displayOverride
    ) {
        Objects.requireNonNull(context, "context");
        SkillArtifactStore.PendingArtifact pending = artifacts.writePending(uploadId, input);
        SkillArtifactInspector.InspectedSkillPackage inspected;
        try {
            inspected = inspector.inspect(pending.path());
        } catch (RuntimeException exception) {
            artifacts.deletePending(pending);
            throw exception;
        }
        final String displayName = resolveDisplayName(inspected, displayOverride);
        final String description = resolveDescription(inspected, displayOverride);

        try (SkillArtifactStore.ArtifactMutationLock ignored = artifacts.lockForMutation(pending)) {
            SkillArtifactStore.StoredArtifact[] finalized = new SkillArtifactStore.StoredArtifact[1];
            try {
                return requireResult(transactions.execute(status -> {
                    SkillVersion existing = skills.findExistingVersion(
                        context.tenantId(), inspected.skillId(), inspected.sourceDshVersion(), pending.sha256()
                    ).orElse(null);
                    if (existing != null) return new UploadResult(existing, false);

                    SkillPackage skillPackage = skills.findPackageBySkillIdForUpdate(
                        context.tenantId(), inspected.skillId()
                    ).orElse(null);
                    if (skillPackage == null) {
                        skillPackage = new SkillPackage(
                            positiveId(), context.tenantId(), inspected.skillId(), displayName,
                            description, SkillPackage.Status.ACTIVE, 0
                        );
                        skills.insertPackage(skillPackage);
                    }

                    long versionId = positiveId();
                    finalized[0] = artifacts.finalizeArtifact(pending);
                    SkillVersion uploaded = new SkillVersion(
                        versionId, context.tenantId(), skillPackage.id(), inspected.skillId(), inspected.sourceDshVersion(),
                        finalized[0].artifactRef(), pending.sizeBytes(), pending.sha256(),
                        SkillVersion.Status.VALIDATED, inspected.skills().size(), inspected.skills(),
                        context.actorId(), Instant.now(clock), 0
                    );
                    skills.insertVersion(uploaded);
                    if (!skills.incrementPackageRevision(
                        context.tenantId(), skillPackage.id(), skillPackage.revision()
                    )) {
                        throw packageConflict(context.tenantId(), skillPackage.id(), skillPackage.revision());
                    }
                    SkillVersion validated = skills.findVersion(context.tenantId(), versionId).orElseThrow();
                    audit(
                        context, AuditAction.SKILL_VERSION_UPLOADED, "SKILL_VERSION", versionId,
                        new SkillAuditMetadata.Upload(
                            skillPackage.id(), versionId, inspected.skillId(), inspected.sourceDshVersion(),
                            pending.sha256(), pending.sizeBytes()
                        )
                    );
                    return new UploadResult(validated, true);
                }));
            } catch (DataIntegrityViolationException exception) {
                artifacts.deleteStored(finalized[0]);
                SkillVersion existing = skills.findExistingVersion(
                    context.tenantId(), inspected.skillId(), inspected.sourceDshVersion(), pending.sha256()
                ).orElse(null);
                if (existing != null) return new UploadResult(existing, false);
                throw new IllegalArgumentException("技能 package/version 或 SHA-256 冲突", exception);
            } catch (RuntimeException exception) {
                artifacts.deleteStored(finalized[0]);
                throw exception;
            }
        } finally {
            artifacts.deletePending(pending);
        }
    }

    public SkillVersion publish(SkillMutationContext context, long versionId, long expectedRevision) {
        return changeStatus(
            context, versionId, expectedRevision, SkillVersion.Status.VALIDATED, SkillVersion.Status.PUBLISHED,
            AuditAction.SKILL_VERSION_PUBLISHED
        );
    }

    public SkillVersion retire(SkillMutationContext context, long versionId, long expectedRevision) {
        return changeStatus(
            context, versionId, expectedRevision, SkillVersion.Status.PUBLISHED, SkillVersion.Status.RETIRED,
            AuditAction.SKILL_VERSION_RETIRED
        );
    }

    public List<SkillAssignment> replaceAssignments(
        SkillMutationContext context,
        long packageId,
        long expectedRevision,
        List<AssignmentSpec> specs
    ) {
        Objects.requireNonNull(specs, "specs");
        if (specs.size() > 200) throw new IllegalArgumentException("可见范围条目超过上限");
        boolean hasAll = false;
        Set<Long> users = new HashSet<>();
        for (AssignmentSpec spec : specs) {
            if (spec.subjectType() == SkillAssignment.SubjectType.ALL) {
                if (hasAll) throw new IllegalArgumentException("ALL 可见范围只能有一条");
                hasAll = true;
            } else {
                long subjectId = spec.requireSubjectId();
                if (!users.add(subjectId)) throw new IllegalArgumentException("USER 可见范围重复");
                if (!skills.subjectExists(SkillAssignment.SubjectType.USER, subjectId)) {
                    throw new IllegalArgumentException("可见范围成员不存在");
                }
            }
        }
        final boolean all = hasAll;
        final int userCount = users.size();
        return requireResult(transactions.execute(status -> {
            SkillPackage skillPackage = skills.findPackageByIdForUpdate(context.tenantId(), packageId)
                .orElseThrow(SkillResourceNotFoundException::new);
            if (skillPackage.revision() != expectedRevision) {
                throw packageConflict(context.tenantId(), packageId, expectedRevision);
            }
            skills.deleteAssignments(context.tenantId(), packageId);
            List<SkillAssignment> inserted = new ArrayList<>();
            if (all) {
                SkillAssignment assignment = new SkillAssignment(
                    positiveId(), context.tenantId(), packageId, SkillAssignment.SubjectType.ALL, null,
                    SkillAssignment.Status.ACTIVE, 0
                );
                skills.insertAssignment(assignment);
                inserted.add(assignment);
            }
            for (Long userId : users) {
                SkillAssignment assignment = new SkillAssignment(
                    positiveId(), context.tenantId(), packageId, SkillAssignment.SubjectType.USER, userId,
                    SkillAssignment.Status.ACTIVE, 0
                );
                skills.insertAssignment(assignment);
                inserted.add(assignment);
            }
            if (!skills.incrementPackageRevision(context.tenantId(), packageId, expectedRevision)) {
                throw packageConflict(context.tenantId(), packageId, expectedRevision);
            }
            audit(
                context, AuditAction.SKILL_ASSIGNMENTS_REPLACED, "SKILL_PACKAGE", packageId,
                new SkillAuditMetadata.Assignments(packageId, all, userCount)
            );
            return inserted;
        }));
    }

    private SkillVersion changeStatus(
        SkillMutationContext context,
        long versionId,
        long expectedRevision,
        SkillVersion.Status from,
        SkillVersion.Status to,
        AuditAction action
    ) {
        return requireResult(transactions.execute(status -> {
            SkillVersion version = skills.findVersion(context.tenantId(), versionId)
                .orElseThrow(SkillResourceNotFoundException::new);
            if (version.status() != from) throw new SkillAccessException(SkillAccessException.NOT_PUBLISHED);
            if (!skills.transitionVersion(context.tenantId(), versionId, from, to, expectedRevision)) {
                throw versionConflict(context.tenantId(), versionId, expectedRevision);
            }
            SkillVersion updated = skills.findVersion(context.tenantId(), versionId).orElseThrow();
            SkillAuditMetadata metadata = action == AuditAction.SKILL_VERSION_PUBLISHED
                ? new SkillAuditMetadata.Publish(updated.packageId(), updated.id(), updated.revision())
                : new SkillAuditMetadata.Retire(updated.packageId(), updated.id(), updated.revision());
            audit(context, action, "SKILL_VERSION", versionId, metadata);
            return updated;
        }));
    }

    private static String resolveDisplayName(
        SkillArtifactInspector.InspectedSkillPackage inspected,
        SkillDisplayOverride displayOverride
    ) {
        if (displayOverride == null || displayOverride.displayName() == null || displayOverride.displayName().isBlank()) {
            return inspected.displayName();
        }
        String value = displayOverride.displayName().trim();
        if (value.isEmpty() || value.length() > 120) throw new IllegalArgumentException("显示名称非法");
        return value;
    }

    private static String resolveDescription(
        SkillArtifactInspector.InspectedSkillPackage inspected,
        SkillDisplayOverride displayOverride
    ) {
        if (displayOverride == null || displayOverride.description() == null || displayOverride.description().isBlank()) {
            return inspected.description();
        }
        String value = displayOverride.description().trim();
        if (value.length() > 2000) throw new IllegalArgumentException("描述过长");
        return value;
    }

    private long positiveId() {
        long id = ids.getAsLong();
        if (id <= 0) throw new IllegalStateException("ID 必须为正数");
        return id;
    }

    private RevisionConflictException packageConflict(String tenantId, long packageId, long expected) {
        long actual = skills.findPackageById(tenantId, packageId)
            .map(SkillPackage::revision).orElseThrow(SkillResourceNotFoundException::new);
        return new RevisionConflictException(expected, actual);
    }

    private RevisionConflictException versionConflict(String tenantId, long versionId, long expected) {
        long actual = skills.findVersion(tenantId, versionId)
            .map(SkillVersion::revision).orElseThrow(SkillResourceNotFoundException::new);
        return new RevisionConflictException(expected, actual);
    }

    private void audit(
        SkillMutationContext context,
        AuditAction action,
        String resourceType,
        long resourceId,
        SkillAuditMetadata metadata
    ) {
        auditSink.append(new AuditEvent(
            positiveId(), context.tenantId(), Instant.now(clock), AuditActorType.USER, context.actorId(), null,
            action, resourceType, Long.toString(resourceId), AuditResult.SUCCESS, null, context.requestId(),
            context.sourceIp(), context.userAgentHash(), metadata
        ));
    }

    private static <T> T requireResult(T value) {
        return Objects.requireNonNull(value, "transaction result");
    }

    public record CatalogItem(
        SkillPackage skillPackage,
        List<SkillVersion> versions,
        List<SkillAssignment> assignments
    ) {
    }

    public record UploadResult(SkillVersion version, boolean created) {
    }

    public record AssignmentSpec(SkillAssignment.SubjectType subjectType, Long subjectId) {
        public AssignmentSpec {
            Objects.requireNonNull(subjectType, "subjectType");
        }

        public long requireSubjectId() {
            if (subjectId == null || subjectId <= 0) throw new IllegalArgumentException("USER 可见范围缺少 subjectId");
            return subjectId;
        }
    }
}
