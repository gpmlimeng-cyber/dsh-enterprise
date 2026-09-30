/**
 * [INPUT]: 依赖 BrandingService、内存 BrandingStore 假实现、真实 CAS 资产库与真实位图 inspector。
 * [OUTPUT]: 验证首发布/CAS 冲突/回滚追加新 revision/草稿校验/已发布资产定位与审计动作。
 * [POS]: branding/application 的纯 JVM 状态机门禁，不依赖 PostgreSQL 即可证明 revision 语义与审计同事务编排。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.application;

import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.branding.artifact.BrandingAssetStore;
import com.owndsh.enterprise.branding.artifact.BrandingImageInspector;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingConfig;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import com.owndsh.enterprise.branding.domain.BrandingLogoSlot;
import com.owndsh.enterprise.branding.persistence.BrandingStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class BrandingServiceTest {
    private static final String TENANT = "000000";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-30T03:00:00Z"), ZoneOffset.UTC);
    private static final TransactionOperations TRANSACTIONS = new TransactionOperations() {
        @Override
        public <T> T execute(TransactionCallback<T> action) {
            return action.doInTransaction(new SimpleTransactionStatus());
        }
    };

    @TempDir
    Path artifactRoot;

    private FakeBrandingStore store;
    private List<AuditEvent> audits;
    private BrandingService service;
    private final AtomicLong ids = new AtomicLong(1000);

    @BeforeEach
    void setUp() {
        store = new FakeBrandingStore();
        audits = new ArrayList<>();
        AuditSink sink = audits::add;
        service = new BrandingService(
            TRANSACTIONS, store, new BrandingAssetStore(artifactRoot, 524_288L),
            new BrandingImageInspector(8192), sink, ids::incrementAndGet, CLOCK
        );
    }

    @Test
    void publishesFirstRevisionAndRejectsStaleCas() {
        BrandingService.PublishedBranding first = service.publish(
            context(), 0, draft("DSH 企业版", "DSH", "探索未至之境", "预览版", null)
        );
        assertThat(first.revision()).isEqualTo(1);
        assertThat(first.document().name()).isEqualTo("DSH 企业版");
        assertThat(first.updatedBy()).isEqualTo(7L);
        assertThat(audits).hasSize(1);
        assertThat(audits.getFirst().action().name()).isEqualTo("BRANDING_PUBLISHED");
        assertThat(audits.getFirst().metadata()).isInstanceOf(BrandingAuditMetadata.Published.class);

        BrandingService.PublishedBranding second = service.publish(context(), 1, draft("第二版", null, null, null, null));
        assertThat(second.revision()).isEqualTo(2);
        assertThat(service.current(TENANT).document().name()).isEqualTo("第二版");

        assertThatThrownBy(() -> service.publish(context(), 1, draft("过期", null, null, null, null)))
            .isInstanceOf(RevisionConflictException.class)
            .satisfies(exception -> {
                RevisionConflictException conflict = (RevisionConflictException) exception;
                assertThat(conflict.expectedRevision()).isEqualTo(1);
                assertThat(conflict.currentRevision()).isEqualTo(2);
            });
        assertThat(service.current(TENANT).revision()).isEqualTo(2);
        assertThat(audits).hasSize(2);
    }

    @Test
    void rollsBackByAppendingCopyOfEarlierRevision() {
        service.publish(context(), 0, draft("第一版", null, "第一个欢迎语", null, null));
        service.publish(context(), 1, draft("第二版", null, "第二个欢迎语", "预览版", null));

        BrandingService.PublishedBranding rolled = service.rollback(context(), 2, 1);

        assertThat(rolled.revision()).isEqualTo(3);
        assertThat(rolled.document().name()).isEqualTo("第一版");
        assertThat(rolled.document().welcomeHeadline()).isEqualTo("第一个欢迎语");
        assertThat(rolled.document().welcomeEditionLabel()).isNull();
        assertThat(store.documents).hasSize(3);
        BrandingAuditMetadata.RolledBack metadata = (BrandingAuditMetadata.RolledBack) audits.get(2).metadata();
        assertThat(metadata.fromRevision()).isEqualTo(2);
        assertThat(metadata.targetRevision()).isEqualTo(1);
        assertThat(metadata.revision()).isEqualTo(3);
        assertThat(audits.get(2).action().name()).isEqualTo("BRANDING_ROLLED_BACK");

        assertThatThrownBy(() -> service.rollback(context(), 3, 3))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("更早的 revision");
    }

    @Test
    void rejectsUnknownTargetRevisionAndEmptyDraft() {
        service.publish(context(), 0, draft("第一版", null, null, null, null));

        assertThatThrownBy(() -> service.rollback(context(), 1, 0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("必须为正数");
        assertThatThrownBy(() -> service.publish(context(), 1, draft(null, null, "  ", null, null)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("不能全部为空");
        assertThatThrownBy(() -> service.publish(context(), 1, draft("x".repeat(121), null, null, null, null)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("长度上限");
    }

    @Test
    void resolvesOnlyAssetsReferencedByThePublishedRevision() throws IOException {
        long assetId = uploadPng();
        BrandingService.PublishedBranding published = service.publish(
            context(), 0, draft("DSH", null, null, null, assetId)
        );
        BrandingAsset asset = published.assets().get(BrandingLogoSlot.LIGHT);
        assertThat(asset).isNotNull();
        assertThat(asset.id()).isEqualTo(assetId);

        BrandingService.PublishedAsset located = service.locatePublishedAsset(TENANT, 1, asset.sha256());
        assertThat(located.asset().id()).isEqualTo(assetId);
        assertThat(located.path()).exists();

        assertThatThrownBy(() -> service.locatePublishedAsset(TENANT, 2, asset.sha256()))
            .isInstanceOf(BrandingResourceNotFoundException.class);
        assertThatThrownBy(() -> service.locatePublishedAsset(TENANT, 1, "b".repeat(64)))
            .isInstanceOf(BrandingResourceNotFoundException.class);
        assertThatThrownBy(() -> service.publish(context(), 1, draft("x", null, null, null, assetId + 1)))
            .isInstanceOf(BrandingResourceNotFoundException.class);
    }

    @Test
    void unconfiguredDeploymentReportsRevisionZeroWithoutErrors() {
        BrandingService.PublishedBranding current = service.current(TENANT);

        assertThat(current.revision()).isZero();
        assertThat(current.document()).isNull();
        assertThat(current.assets()).isEmpty();
        assertThat(audits).isEmpty();
    }

    private long uploadPng() throws IOException {
        byte[] png = new byte[24];
        System.arraycopy(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, 0, png, 0, 8);
        System.arraycopy(new byte[] {'I', 'H', 'D', 'R'}, 0, png, 12, 4);
        png[18] = 1;
        png[22] = 1;
        Path source = artifactRoot.resolve("upload.png");
        Files.write(source, png);
        try (InputStream input = Files.newInputStream(source)) {
            return service.uploadAsset(context(), UUID.randomUUID(), input).id();
        }
    }

    private static BrandingMutationContext context() {
        return new BrandingMutationContext(TENANT, 7, "req_test", null, null);
    }

    private static BrandingService.BrandingDraft draft(
        String name, String shortName, String headline, String editionLabel, Long lightAssetId
    ) {
        return new BrandingService.BrandingDraft(name, shortName, lightAssetId, null, null, headline, editionLabel);
    }

    /**
     * 内存 BrandingStore 假实现：只模拟 V32 表的行级 CAS 与联结查询语义。
     */
    private static final class FakeBrandingStore implements BrandingStore {
        private final List<BrandingConfig> configs = new ArrayList<>();
        private final List<BrandingDocument> documents = new ArrayList<>();
        private final Map<Long, BrandingAsset> assets = new LinkedHashMap<>();

        @Override
        public Optional<BrandingConfig> findConfig(String tenantId) {
            return configs.stream().filter(value -> value.tenantId().equals(tenantId)).findFirst();
        }

        @Override
        public Optional<BrandingConfig> findConfigForUpdate(String tenantId) {
            return findConfig(tenantId);
        }

        @Override
        public boolean insertConfigIfAbsent(long id, String tenantId, Instant updatedAt) {
            if (findConfig(tenantId).isPresent()) return false;
            configs.add(new BrandingConfig(id, tenantId, null, 0, null, updatedAt));
            return true;
        }

        @Override
        public boolean compareAndSetRevision(
            String tenantId, long configId, long expectedRevision, long newRevision, long updatedBy, Instant updatedAt
        ) {
            for (int index = 0; index < configs.size(); index++) {
                BrandingConfig value = configs.get(index);
                if (value.id() == configId && value.tenantId().equals(tenantId) && value.revision() == expectedRevision) {
                    configs.set(index, new BrandingConfig(
                        value.id(), value.tenantId(), value.organizationId(), newRevision, updatedBy, updatedAt
                    ));
                    return true;
                }
            }
            return false;
        }

        @Override
        public Optional<BrandingDocument> findCurrentDocument(String tenantId) {
            return findConfig(tenantId).flatMap(config -> documents.stream()
                .filter(document -> document.configId() == config.id() && document.revision() == config.revision())
                .findFirst());
        }

        @Override
        public Optional<BrandingDocument> findDocumentByRevision(String tenantId, long configId, long revision) {
            return documents.stream()
                .filter(document -> document.configId() == configId && document.revision() == revision)
                .findFirst();
        }

        @Override
        public void insertDocument(BrandingDocument document) {
            documents.add(document);
        }

        @Override
        public List<BrandingDocument> listDocuments(String tenantId, long configId, long afterId, int limit) {
            return documents.stream()
                .filter(document -> document.configId() == configId)
                .filter(document -> afterId <= 0 || document.id() < afterId)
                .sorted(Comparator.comparingLong(BrandingDocument::id).reversed())
                .limit(limit)
                .toList();
        }

        @Override
        public Optional<BrandingAsset> findAsset(String tenantId, long assetId) {
            BrandingAsset asset = assets.get(assetId);
            return asset != null && asset.tenantId().equals(tenantId) ? Optional.of(asset) : Optional.empty();
        }

        @Override
        public Optional<BrandingAsset> findAssetByHash(String tenantId, String sha256) {
            return assets.values().stream()
                .filter(asset -> asset.tenantId().equals(tenantId) && asset.sha256().equals(sha256))
                .findFirst();
        }

        @Override
        public void insertAsset(BrandingAsset asset) {
            assets.put(asset.id(), asset);
        }

        @Override
        public Optional<BrandingAsset> findPublishedAssetByHash(String tenantId, long configRevision, String sha256) {
            return findConfig(tenantId)
                .flatMap(config -> findDocumentByRevision(tenantId, config.id(), configRevision))
                .flatMap(document -> {
                    for (BrandingLogoSlot slot : BrandingLogoSlot.values()) {
                        Long assetId = document.assetId(slot);
                        if (assetId == null) continue;
                        BrandingAsset asset = assets.get(assetId);
                        if (asset != null && asset.sha256().equals(sha256)) return Optional.of(asset);
                    }
                    return Optional.empty();
                });
        }
    }
}
