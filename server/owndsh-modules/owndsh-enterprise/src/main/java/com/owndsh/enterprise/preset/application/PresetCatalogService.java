/**
 * [INPUT]: 依赖事务、PresetStore、ZIP inspector/CAS store、revision、审计与 ID。
 * [OUTPUT]: 提供配方目录、幂等上传、发布/退休与可见范围原子替换。
 * [POS]: preset/application 的管理状态编排，文件系统补偿与数据库事务在此协调。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.preset.artifact.PresetArtifactInspector;
import com.owndsh.enterprise.preset.artifact.PresetArtifactStore;
import com.owndsh.enterprise.preset.domain.PresetAssignment;
import com.owndsh.enterprise.preset.domain.PresetPackage;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.persistence.PresetStore;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
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

public final class PresetCatalogService {
    private final TransactionOperations transactions;
    private final PresetStore presets;
    private final PresetArtifactStore artifacts;
    private final PresetArtifactInspector inspector;
    private final BootstrapRevisionStore revisions;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public PresetCatalogService(
        TransactionOperations transactions,
        PresetStore presets,
        PresetArtifactStore artifacts,
        PresetArtifactInspector inspector,
        BootstrapRevisionStore revisions,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, presets, artifacts, inspector, revisions, auditSink, ids, Clock.systemUTC());
    }

    PresetCatalogService(
        TransactionOperations transactions,
        PresetStore presets,
        PresetArtifactStore artifacts,
        PresetArtifactInspector inspector,
        BootstrapRevisionStore revisions,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.presets = Objects.requireNonNull(presets, "presets");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.revisions = Objects.requireNonNull(revisions, "revisions");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<CatalogItem> list(String tenantId, long afterId, int limit) {
        return presets.listPackages(tenantId, afterId, limit).stream()
            .map(value -> new CatalogItem(
                value,
                presets.listVersions(tenantId, value.id()),
                presets.listAssignments(tenantId, value.id())
            ))
            .toList();
    }

    public UploadResult upload(
        PresetMutationContext context,
        UUID uploadId,
        InputStream input,
        PresetDisplayOverride displayOverride
    ) {
        Objects.requireNonNull(context, "context");
        PresetArtifactStore.PendingArtifact pending = artifacts.writePending(uploadId, input);
        PresetArtifactInspector.InspectedPreset inspected;
        try {
            inspected = inspector.inspect(pending.path());
        } catch (RuntimeException exception) {
            artifacts.deletePending(pending);
            throw exception;
        }
        final String displayName = resolveDisplayName(inspected, displayOverride);
        final String description = resolveDescription(inspected, displayOverride);

        try (PresetArtifactStore.ArtifactMutationLock ignored = artifacts.lockForMutation(pending)) {
            PresetArtifactStore.StoredArtifact[] finalized = new PresetArtifactStore.StoredArtifact[1];
            try {
                return requireResult(transactions.execute(status -> {
                    PresetVersion existing = presets.findExistingVersion(
                        context.tenantId(), inspected.presetId(), inspected.sourceDshVersion(), pending.sha256()
                    ).orElse(null);
                    if (existing != null) return new UploadResult(existing, false);

                    PresetPackage presetPackage = presets.findPackageByPresetIdForUpdate(
                        context.tenantId(), inspected.presetId()
                    ).orElse(null);
                    if (presetPackage == null) {
                        presetPackage = new PresetPackage(
                            positiveId(), context.tenantId(), inspected.presetId(), displayName,
                            description, PresetPackage.Status.ACTIVE, 0
                        );
                        presets.insertPackage(presetPackage);
                    }

                    long versionId = positiveId();
                    finalized[0] = artifacts.finalizeArtifact(pending);
                    PresetVersion uploaded = new PresetVersion(
                        versionId, context.tenantId(), presetPackage.id(), inspected.sourceDshVersion(),
                        finalized[0].artifactRef(), pending.sizeBytes(), pending.sha256(),
                        PresetVersion.Status.VALIDATED, context.actorId(), Instant.now(clock), 0
                    );
                    presets.insertVersion(uploaded);
                    if (!presets.incrementPackageRevision(
                        context.tenantId(), presetPackage.id(), presetPackage.revision()
                    )) {
                        throw packageConflict(context.tenantId(), presetPackage.id(), presetPackage.revision());
                    }
                    PresetVersion validated = presets.findVersion(context.tenantId(), versionId).orElseThrow();
                    audit(
                        context, AuditAction.PRESET_VERSION_UPLOADED, "PRESET_VERSION", versionId,
                        new PresetAuditMetadata.Upload(
                            presetPackage.id(), versionId, inspected.presetId(), inspected.sourceDshVersion(),
                            pending.sha256(), pending.sizeBytes()
                        )
                    );
                    return new UploadResult(validated, true);
                }));
            } catch (DataIntegrityViolationException exception) {
                artifacts.deleteStored(finalized[0]);
                PresetVersion existing = presets.findExistingVersion(
                    context.tenantId(), inspected.presetId(), inspected.sourceDshVersion(), pending.sha256()
                ).orElse(null);
                if (existing != null) return new UploadResult(existing, false);
                throw new IllegalArgumentException("配方 package/version 或 SHA-256 冲突", exception);
            } catch (RuntimeException exception) {
                artifacts.deleteStored(finalized[0]);
                throw exception;
            }
        } finally {
            artifacts.deletePending(pending);
        }
    }

    public PresetVersion publish(PresetMutationContext context, long versionId, long expectedRevision) {
        return changeStatus(
            context, versionId, expectedRevision, PresetVersion.Status.VALIDATED, PresetVersion.Status.PUBLISHED,
            AuditAction.PRESET_VERSION_PUBLISHED
        );
    }

    public PresetVersion retire(PresetMutationContext context, long versionId, long expectedRevision) {
        return changeStatus(
            context, versionId, expectedRevision, PresetVersion.Status.PUBLISHED, PresetVersion.Status.RETIRED,
            AuditAction.PRESET_VERSION_RETIRED
        );
    }

    public List<PresetAssignment> replaceAssignments(
        PresetMutationContext context,
        long packageId,
        long expectedRevision,
        List<AssignmentSpec> specs
    ) {
        Objects.requireNonNull(specs, "specs");
        if (specs.size() > 200) throw new IllegalArgumentException("可见范围条目超过上限");
        boolean hasAll = false;
        Set<Long> users = new HashSet<>();
        for (AssignmentSpec spec : specs) {
            if (spec.subjectType() == PresetAssignment.SubjectType.ALL) {
                if (hasAll) throw new IllegalArgumentException("ALL 可见范围只能有一条");
                hasAll = true;
            } else {
                long subjectId = spec.requireSubjectId();
                if (!users.add(subjectId)) throw new IllegalArgumentException("USER 可见范围重复");
                if (!presets.subjectExists(PresetAssignment.SubjectType.USER, subjectId)) {
                    throw new IllegalArgumentException("可见范围成员不存在");
                }
            }
        }
        final boolean all = hasAll;
        final int userCount = users.size();
        return requireResult(transactions.execute(status -> {
            PresetPackage presetPackage = presets.findPackageByIdForUpdate(context.tenantId(), packageId)
                .orElseThrow(PresetResourceNotFoundException::new);
            if (presetPackage.revision() != expectedRevision) {
                throw packageConflict(context.tenantId(), packageId, expectedRevision);
            }
            presets.deleteAssignments(context.tenantId(), packageId);
            List<PresetAssignment> inserted = new ArrayList<>();
            if (all) {
                PresetAssignment assignment = new PresetAssignment(
                    positiveId(), context.tenantId(), packageId, PresetAssignment.SubjectType.ALL, null,
                    PresetAssignment.Status.ACTIVE, 0
                );
                presets.insertAssignment(assignment);
                inserted.add(assignment);
            }
            for (Long userId : users) {
                PresetAssignment assignment = new PresetAssignment(
                    positiveId(), context.tenantId(), packageId, PresetAssignment.SubjectType.USER, userId,
                    PresetAssignment.Status.ACTIVE, 0
                );
                presets.insertAssignment(assignment);
                inserted.add(assignment);
            }
            if (!presets.incrementPackageRevision(context.tenantId(), packageId, expectedRevision)) {
                throw packageConflict(context.tenantId(), packageId, expectedRevision);
            }
            audit(
                context, AuditAction.PRESET_ASSIGNMENTS_REPLACED, "PRESET_PACKAGE", packageId,
                new PresetAuditMetadata.Assignments(packageId, all, userCount)
            );
            return inserted;
        }));
    }

    private PresetVersion changeStatus(
        PresetMutationContext context,
        long versionId,
        long expectedRevision,
        PresetVersion.Status from,
        PresetVersion.Status to,
        AuditAction action
    ) {
        return requireResult(transactions.execute(status -> {
            PresetVersion version = presets.findVersion(context.tenantId(), versionId)
                .orElseThrow(PresetResourceNotFoundException::new);
            if (version.status() != from) throw new PresetAccessException(PresetAccessException.NOT_PUBLISHED);
            if (!presets.transitionVersion(context.tenantId(), versionId, from, to, expectedRevision)) {
                throw versionConflict(context.tenantId(), versionId, expectedRevision);
            }
            PresetVersion updated = presets.findVersion(context.tenantId(), versionId).orElseThrow();
            PresetAuditMetadata metadata = action == AuditAction.PRESET_VERSION_PUBLISHED
                ? new PresetAuditMetadata.Publish(updated.packageId(), updated.id(), updated.revision())
                : new PresetAuditMetadata.Retire(updated.packageId(), updated.id(), updated.revision());
            audit(context, action, "PRESET_VERSION", versionId, metadata);
            return updated;
        }));
    }

    private static String resolveDisplayName(
        PresetArtifactInspector.InspectedPreset inspected,
        PresetDisplayOverride displayOverride
    ) {
        if (displayOverride == null || displayOverride.displayName() == null || displayOverride.displayName().isBlank()) {
            return inspected.displayName();
        }
        String value = displayOverride.displayName().trim();
        if (value.isEmpty() || value.length() > 120) throw new IllegalArgumentException("显示名称非法");
        return value;
    }

    private static String resolveDescription(
        PresetArtifactInspector.InspectedPreset inspected,
        PresetDisplayOverride displayOverride
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
        long actual = presets.findPackageById(tenantId, packageId)
            .map(PresetPackage::revision).orElseThrow(PresetResourceNotFoundException::new);
        return new RevisionConflictException(expected, actual);
    }

    private RevisionConflictException versionConflict(String tenantId, long versionId, long expected) {
        long actual = presets.findVersion(tenantId, versionId)
            .map(PresetVersion::revision).orElseThrow(PresetResourceNotFoundException::new);
        return new RevisionConflictException(expected, actual);
    }

    private void audit(
        PresetMutationContext context,
        AuditAction action,
        String resourceType,
        long resourceId,
        PresetAuditMetadata metadata
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
        PresetPackage presetPackage,
        List<PresetVersion> versions,
        List<PresetAssignment> assignments
    ) {
    }

    public record UploadResult(PresetVersion version, boolean created) {
    }

    public record AssignmentSpec(PresetAssignment.SubjectType subjectType, Long subjectId) {
        public AssignmentSpec {
            Objects.requireNonNull(subjectType, "subjectType");
        }

        public long requireSubjectId() {
            if (subjectId == null || subjectId <= 0) throw new IllegalArgumentException("USER 可见范围缺少 subjectId");
            return subjectId;
        }
    }
}
