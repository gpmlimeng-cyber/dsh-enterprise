/**
 * [INPUT]: 依赖事务、BrandingStore、位图 inspector/CAS store、revision、审计与 ID。
 * [OUTPUT]: 提供公开只读投影、幂等资上传、发布与回滚事务编排。
 * [POS]: branding/application 的状态编排；单行配置的乐观 revision 与不可变发布文档在同一个事务内推进。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.branding.artifact.BrandingAssetStore;
import com.owndsh.enterprise.branding.artifact.BrandingImageInspector;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingConfig;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import com.owndsh.enterprise.branding.domain.BrandingLogoSlot;
import com.owndsh.enterprise.branding.persistence.BrandingStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

import java.io.InputStream;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.LongSupplier;

public final class BrandingService {
    private final TransactionOperations transactions;
    private final BrandingStore branding;
    private final BrandingAssetStore artifacts;
    private final BrandingImageInspector inspector;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public BrandingService(
        TransactionOperations transactions,
        BrandingStore branding,
        BrandingAssetStore artifacts,
        BrandingImageInspector inspector,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, branding, artifacts, inspector, auditSink, ids, Clock.systemUTC());
    }

    BrandingService(
        TransactionOperations transactions,
        BrandingStore branding,
        BrandingAssetStore artifacts,
        BrandingImageInspector inspector,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.branding = Objects.requireNonNull(branding, "branding");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * 公开只读投影：未配置时 revision=0 且没有文档，客户端据此回退内置默认。
     */
    public PublishedBranding current(String tenantId) {
        return requireResult(transactions.execute(status -> load(tenantId)));
    }

    /**
     * 公开资源定位：只有当前发布文档引用过的 hash 才能被匿名读取。
     */
    public PublishedAsset locatePublishedAsset(String tenantId, long revision, String sha256) {
        if (revision <= 0) throw new BrandingResourceNotFoundException();
        BrandingAsset asset = branding.findPublishedAssetByHash(tenantId, revision, sha256)
            .orElseThrow(BrandingResourceNotFoundException::new);
        return new PublishedAsset(asset, artifacts.resolve(asset.artifactRef()));
    }

    public BrandingAsset requireAsset(String tenantId, long assetId) {
        if (assetId <= 0) throw new BrandingResourceNotFoundException();
        return branding.findAsset(tenantId, assetId).orElseThrow(BrandingResourceNotFoundException::new);
    }

    public Path requireContent(BrandingAsset asset) {
        return artifacts.resolve(asset.artifactRef());
    }

    public ListRevisions listRevisions(String tenantId, long afterId, int limit) {
        Objects.requireNonNull(tenantId, "tenantId");
        return requireResult(transactions.execute(status -> {
            Optional<BrandingConfig> config = branding.findConfig(tenantId);
            if (config.isEmpty()) return new ListRevisions(List.of(), false);
            List<BrandingDocument> fetched = branding.listDocuments(tenantId, config.get().id(), afterId, limit);
            boolean hasMore = fetched.size() > limit;
            return new ListRevisions(hasMore ? fetched.subList(0, limit) : fetched, hasMore);
        }));
    }

    public BrandingAsset uploadAsset(BrandingMutationContext context, UUID uploadId, InputStream input) {
        Objects.requireNonNull(context, "context");
        BrandingAssetStore.PendingAsset pending = artifacts.writePending(uploadId, input);
        try {
            BrandingImageInspector.InspectedImage image = inspector.inspect(pending.path());
            try (BrandingAssetStore.AssetMutationLock ignored = artifacts.lockForMutation(pending)) {
                return requireResult(transactions.execute(status -> {
                    Optional<BrandingAsset> existing = branding.findAssetByHash(context.tenantId(), pending.sha256());
                    if (existing.isPresent()) return existing.get();
                    BrandingAssetStore.StoredAsset stored = artifacts.finalizeAsset(pending);
                    BrandingAsset asset = new BrandingAsset(
                        positiveId(), context.tenantId(), stored.artifactRef(), pending.sha256(),
                        image.contentType(), pending.sizeBytes(), image.width(), image.height(),
                        context.actorId(), Instant.now(clock)
                    );
                    try {
                        branding.insertAsset(asset);
                    } catch (DataIntegrityViolationException exception) {
                        // 同 hash 资产已存在：保留共享 CAS 文件并复用既有行。
                        return branding.findAssetByHash(context.tenantId(), pending.sha256())
                            .orElseThrow(() -> exception);
                    }
                    return asset;
                }));
            }
        } finally {
            artifacts.deletePending(pending);
        }
    }

    public PublishedBranding publish(BrandingMutationContext context, long expectedRevision, BrandingDraft draft) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(draft, "draft");
        return requireResult(transactions.execute(status -> {
            BrandingConfig config = lockConfig(context.tenantId(), expectedRevision);
            if (config.revision() != expectedRevision) {
                throw new RevisionConflictException(expectedRevision, config.revision());
            }
            validate(draft);
            Long light = requireAssetId(context.tenantId(), draft.logoLightAssetId());
            Long dark = requireAssetId(context.tenantId(), draft.logoDarkAssetId());
            Long square = requireAssetId(context.tenantId(), draft.logoSquareAssetId());
            long revision = config.revision() + 1;
            Instant now = Instant.now(clock);
            branding.insertDocument(new BrandingDocument(
                positiveId(), context.tenantId(), config.id(), revision,
                normalize(draft.name()), normalize(draft.shortName()), light, dark, square,
                normalize(draft.welcomeHeadline()), normalize(draft.welcomeEditionLabel()),
                context.actorId(), now
            ));
            if (!branding.compareAndSetRevision(
                context.tenantId(), config.id(), config.revision(), revision, context.actorId(), now
            )) {
                throw new RevisionConflictException(expectedRevision, config.revision());
            }
            audit(context, AuditAction.BRANDING_PUBLISHED, config.id(),
                new BrandingAuditMetadata.Published(config.id(), revision, logoCount(light, dark, square)));
            return load(context.tenantId());
        }));
    }

    public PublishedBranding rollback(BrandingMutationContext context, long expectedRevision, long targetRevision) {
        Objects.requireNonNull(context, "context");
        if (targetRevision <= 0) throw new IllegalArgumentException("targetRevision 必须为正数");
        return requireResult(transactions.execute(status -> {
            BrandingConfig config = lockConfig(context.tenantId(), expectedRevision);
            if (config.revision() != expectedRevision) {
                throw new RevisionConflictException(expectedRevision, config.revision());
            }
            if (targetRevision >= config.revision()) {
                throw new IllegalArgumentException("只能回滚到更早的 revision");
            }
            BrandingDocument target = branding.findDocumentByRevision(
                context.tenantId(), config.id(), targetRevision
            ).orElseThrow(BrandingResourceNotFoundException::new);
            long revision = config.revision() + 1;
            Instant now = Instant.now(clock);
            branding.insertDocument(new BrandingDocument(
                positiveId(), context.tenantId(), config.id(), revision,
                target.name(), target.shortName(), target.logoLightAssetId(), target.logoDarkAssetId(),
                target.logoSquareAssetId(), target.welcomeHeadline(), target.welcomeEditionLabel(),
                context.actorId(), now
            ));
            if (!branding.compareAndSetRevision(
                context.tenantId(), config.id(), config.revision(), revision, context.actorId(), now
            )) {
                throw new RevisionConflictException(expectedRevision, config.revision());
            }
            audit(context, AuditAction.BRANDING_ROLLED_BACK, config.id(),
                new BrandingAuditMetadata.RolledBack(config.id(), config.revision(), targetRevision, revision));
            return load(context.tenantId());
        }));
    }

    private BrandingConfig lockConfig(String tenantId, long expectedRevision) {
        BrandingConfig config = branding.findConfigForUpdate(tenantId).orElse(null);
        if (config != null) return config;
        if (expectedRevision != 0) throw new RevisionConflictException(expectedRevision, 0);
        branding.insertConfigIfAbsent(positiveId(), tenantId, Instant.now(clock));
        return branding.findConfigForUpdate(tenantId)
            .orElseThrow(() -> new IllegalStateException("品牌配置单行创建失败"));
    }

    private PublishedBranding load(String tenantId) {
        Optional<BrandingConfig> config = branding.findConfig(tenantId);
        if (config.isEmpty()) return new PublishedBranding(0, null, null, Map.of());
        Optional<BrandingDocument> document = branding.findCurrentDocument(tenantId);
        if (document.isEmpty()) return new PublishedBranding(config.get().revision(), null, config.get().updatedBy(), Map.of());
        BrandingDocument current = document.get();
        Map<BrandingLogoSlot, BrandingAsset> assets = new EnumMap<>(BrandingLogoSlot.class);
        for (BrandingLogoSlot slot : BrandingLogoSlot.values()) {
            Long assetId = current.assetId(slot);
            if (assetId == null) continue;
            branding.findAsset(tenantId, assetId).ifPresent(asset -> assets.put(slot, asset));
        }
        return new PublishedBranding(current.revision(), current, config.get().updatedBy(), Map.copyOf(assets));
    }

    private static void validate(BrandingDraft draft) {
        if (normalize(draft.name()) == null && normalize(draft.shortName()) == null
            && draft.logoLightAssetId() == null && draft.logoDarkAssetId() == null
            && draft.logoSquareAssetId() == null && normalize(draft.welcomeHeadline()) == null
            && normalize(draft.welcomeEditionLabel()) == null) {
            throw new IllegalArgumentException("品牌内容不能全部为空");
        }
        requireLength(draft.name(), BrandingDocument.MAX_NAME_LENGTH, "name");
        requireLength(draft.shortName(), BrandingDocument.MAX_SHORT_NAME_LENGTH, "shortName");
        requireLength(draft.welcomeHeadline(), BrandingDocument.MAX_HEADLINE_LENGTH, "welcome.headline");
        requireLength(draft.welcomeEditionLabel(), BrandingDocument.MAX_EDITION_LABEL_LENGTH, "welcome.editionLabel");
    }

    private Long requireAssetId(String tenantId, Long assetId) {
        if (assetId == null) return null;
        return requireAsset(tenantId, assetId).id();
    }

    private static void requireLength(String value, int max, String name) {
        String normalized = normalize(value);
        if (normalized != null && normalized.length() > max) {
            throw new IllegalArgumentException(name + " 超过长度上限");
        }
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static int logoCount(Long light, Long dark, Long square) {
        int count = 0;
        if (light != null) count++;
        if (dark != null) count++;
        if (square != null) count++;
        return count;
    }

    private long positiveId() {
        long id = ids.getAsLong();
        if (id <= 0) throw new IllegalStateException("ID 必须为正数");
        return id;
    }

    private void audit(
        BrandingMutationContext context,
        AuditAction action,
        long configId,
        BrandingAuditMetadata metadata
    ) {
        auditSink.append(new AuditEvent(
            positiveId(), context.tenantId(), Instant.now(clock), AuditActorType.USER, context.actorId(), null,
            action, "BRANDING", Long.toString(configId), AuditResult.SUCCESS, null, context.requestId(),
            context.sourceIp(), context.userAgentHash(), metadata
        ));
    }

    private static <T> T requireResult(T value) {
        return Objects.requireNonNull(value, "transaction result");
    }

    public record PublishedBranding(
        long revision,
        BrandingDocument document,
        Long updatedBy,
        Map<BrandingLogoSlot, BrandingAsset> assets
    ) {
    }

    public record PublishedAsset(BrandingAsset asset, Path path) {
    }

    public record ListRevisions(List<BrandingDocument> documents, boolean hasMore) {
    }

    public record BrandingDraft(
        String name,
        String shortName,
        Long logoLightAssetId,
        Long logoDarkAssetId,
        Long logoSquareAssetId,
        String welcomeHeadline,
        String welcomeEditionLabel
    ) {
    }
}
