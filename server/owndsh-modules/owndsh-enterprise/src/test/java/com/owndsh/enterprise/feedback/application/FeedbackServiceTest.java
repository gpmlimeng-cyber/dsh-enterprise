/**
 * [INPUT]: 依赖 FeedbackService、内存 FeedbackStore 假实现、真实 CAS 附件库与真实位图 inspector。
 * [OUTPUT]: 验证提交默认值/可信归属、幂等重放、附件闸门、冻结状态链路、CAS 冲突、列表游标与审计动作。
 * [POS]: feedback/application 的纯 JVM 状态机门禁，不依赖 PostgreSQL 即可证明提交与处置的编排语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.feedback.artifact.FeedbackAttachmentException;
import com.owndsh.enterprise.feedback.artifact.FeedbackAttachmentStore;
import com.owndsh.enterprise.feedback.artifact.FeedbackImageInspector;
import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackDiagnostics;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackSubmission;
import com.owndsh.enterprise.feedback.domain.FeedbackType;
import com.owndsh.enterprise.feedback.domain.FeedbackValidationException;
import com.owndsh.enterprise.feedback.persistence.FeedbackStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
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
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class FeedbackServiceTest {
    private static final String TENANT = "000000";
    private static final Instant NOW = Instant.parse("2026-09-30T03:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final TransactionOperations TRANSACTIONS = new TransactionOperations() {
        @Override
        public <T> T execute(TransactionCallback<T> action) {
            return action.doInTransaction(new SimpleTransactionStatus());
        }
    };

    @TempDir
    Path artifactRoot;

    private final AtomicLong ids = new AtomicLong(1000);
    private final List<AuditEvent> audits = new ArrayList<>();
    private FakeFeedbackStore store;
    private FeedbackService service;

    @BeforeEach
    void setUp() {
        store = new FakeFeedbackStore();
        audits.clear();
        AuditSink sink = audits::add;
        service = new FeedbackService(
            TRANSACTIONS, store, new FeedbackAttachmentStore(artifactRoot, 524_288L),
            new FeedbackImageInspector(8192), sink, ids::incrementAndGet, CLOCK
        );
    }

    @Test
    void attributesSubmissionToTheAuthenticatedSessionAndDefaultsOccurredAt() {
        FeedbackRecord submitted = service.submit(
            runtimeContext(), submission(FeedbackType.SUGGESTION, "希望支持夜间模式", null, "dev@example.org"),
            null, List.of(png(4, 4))
        );

        assertThat(submitted.submitterUserId()).isEqualTo(7);
        assertThat(submitted.deviceId()).isEqualTo("install-01");
        assertThat(submitted.type()).isEqualTo(FeedbackType.SUGGESTION);
        assertThat(submitted.status()).isEqualTo(FeedbackStatus.NEW);
        assertThat(submitted.revision()).isZero();
        assertThat(submitted.occurredAt()).isEqualTo(NOW);
        assertThat(submitted.consent()).isTrue();
        assertThat(submitted.attachmentCount()).isEqualTo(1);
        assertThat(submitted.attachments()).singleElement().satisfies(attachment -> {
            assertThat(attachment.seq()).isEqualTo(1);
            assertThat(attachment.contentType()).isEqualTo("image/png");
            assertThat(attachment.extension()).isEqualTo("png");
            assertThat(attachment.width()).isEqualTo(4);
            assertThat(attachment.height()).isEqualTo(4);
            assertThat(attachment.sha256()).hasSize(64);
        });
        assertThat(service.contentPath(submitted.attachments().getFirst())).exists();

        assertThat(audits).singleElement().satisfies(event -> {
            assertThat(event.action().name()).isEqualTo("FEEDBACK_SUBMITTED");
            assertThat(event.actorId()).isEqualTo(7);
            assertThat(event.resourceType()).isEqualTo("FEEDBACK");
            assertThat(event.metadata()).isInstanceOf(FeedbackAuditMetadata.Submitted.class);
        });
    }

    @Test
    void replayedIdempotencyKeyReturnsTheOriginalRowWithoutSecondAudit() {
        FeedbackSubmission submission = submission(FeedbackType.ISSUE, "重复提交", null, null);
        FeedbackRecord first = service.submit(runtimeContext(), submission, uuid(1), List.of());
        FeedbackRecord second = service.submit(runtimeContext(), submission, uuid(1), List.of());

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(store.records).hasSize(1);
        assertThat(audits).hasSize(1);
        assertThatThrownBy(() -> service.submit(runtimeContext(), submission, "not-a-uuid", List.of()))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("Idempotency-Key");
    }

    @Test
    void rejectsNonBitmapOversizedAndTooManyAttachments() {
        FeedbackSubmission submission = submission(FeedbackType.ISSUE, "附件闸门", null, null);

        assertThatThrownBy(() -> service.submit(
            runtimeContext(), submission, null,
            List.of(new ByteArrayInputStream("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes()))
        ))
            .isInstanceOf(FeedbackAttachmentException.class)
            .hasMessageContaining("PNG/JPEG/WebP");

        assertThatThrownBy(() -> service.submit(
            runtimeContext(), submission, null, List.of(png(4, 4), png(4, 4), png(4, 4), png(4, 4))
        ))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("附件最多 3");

        FeedbackService smallLimit = new FeedbackService(
            TRANSACTIONS, store, new FeedbackAttachmentStore(artifactRoot.resolve("small"), 8L),
            new FeedbackImageInspector(8192), audits::add, ids::incrementAndGet, CLOCK
        );
        assertThatThrownBy(() -> smallLimit.submit(runtimeContext(), submission, null, List.of(png(4, 4))))
            .isInstanceOf(FeedbackAttachmentException.class)
            .satisfies(exception -> assertThat(((FeedbackAttachmentException) exception).kind())
                .isEqualTo(FeedbackAttachmentException.Kind.TOO_LARGE));
    }

    @Test
    void walksTheFrozenTriageChainWithRevisionCasAndAudit() {
        FeedbackRecord submitted = service.submit(
            runtimeContext(), submission(FeedbackType.ISSUE, "状态链路", null, null), null, List.of()
        );

        assertThatThrownBy(() -> service.changeStatus(mutation(), submitted.id(), 0, FeedbackStatus.RESOLVED, null))
            .isInstanceOf(FeedbackStateConflictException.class);
        assertThatThrownBy(() -> service.changeStatus(mutation(), submitted.id(), 9, FeedbackStatus.TRIAGED, null))
            .isInstanceOf(RevisionConflictException.class);

        FeedbackRecord triaged = service.changeStatus(
            mutation(), submitted.id(), 0, FeedbackStatus.TRIAGED, " 已确认复现 "
        );
        assertThat(triaged.status()).isEqualTo(FeedbackStatus.TRIAGED);
        assertThat(triaged.revision()).isEqualTo(1);
        assertThat(triaged.statusNote()).isEqualTo("已确认复现");
        assertThat(triaged.statusChangedBy()).isEqualTo(9);
        assertThat(triaged.statusChangedAt()).isEqualTo(NOW);

        FeedbackRecord resolved = service.changeStatus(
            mutation(), submitted.id(), 1, FeedbackStatus.RESOLVED, null
        );
        assertThat(resolved.status()).isEqualTo(FeedbackStatus.RESOLVED);
        assertThat(resolved.statusNote()).isNull();

        assertThatThrownBy(() -> service.changeStatus(mutation(), submitted.id(), 2, FeedbackStatus.IGNORED, null))
            .isInstanceOf(FeedbackStateConflictException.class);
        assertThatThrownBy(() -> service.changeStatus(
            mutation(), submitted.id(), 2, FeedbackStatus.RESOLVED, "x".repeat(501)
        ))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("500");

        assertThat(audits).hasSize(3);
        FeedbackAuditMetadata.StatusChanged metadata =
            (FeedbackAuditMetadata.StatusChanged) audits.getLast().metadata();
        assertThat(metadata.previousStatus()).isEqualTo(FeedbackStatus.TRIAGED);
        assertThat(metadata.currentStatus()).isEqualTo(FeedbackStatus.RESOLVED);
        assertThat(metadata.revision()).isEqualTo(2);
    }

    @Test
    void listsNewestFirstWithStatusFilterAndRejectsForeignAttachments() {
        FeedbackRecord first = service.submit(
            runtimeContext(), submission(FeedbackType.ISSUE, "第一条", null, null), null, List.of(png(1, 1))
        );
        FeedbackRecord second = service.submit(
            runtimeContext(), submission(FeedbackType.SUGGESTION, "第二条", null, null), null, List.of()
        );
        service.changeStatus(mutation(), second.id(), 0, FeedbackStatus.TRIAGED, null);

        FeedbackService.FeedbackPage all = service.list(TENANT, null, 0, 10);
        assertThat(all.items()).extracting(FeedbackRecord::id).containsExactly(second.id(), first.id());
        assertThat(all.hasMore()).isFalse();

        FeedbackService.FeedbackPage triaged = service.list(TENANT, FeedbackStatus.TRIAGED, 0, 10);
        assertThat(triaged.items()).extracting(FeedbackRecord::id).containsExactly(second.id());

        FeedbackService.FeedbackPage paged = service.list(TENANT, null, second.id(), 10);
        assertThat(paged.items()).extracting(FeedbackRecord::id).containsExactly(first.id());

        assertThatThrownBy(() -> service.detail("999999", first.id()))
            .isInstanceOf(FeedbackNotFoundException.class);
        assertThat(service.detail(TENANT, first.id()).attachments()).hasSize(1);
        assertThat(service.requireAttachment(TENANT, first.id(), first.attachments().getFirst().id()).seq())
            .isEqualTo(1);
        assertThatThrownBy(() -> service.requireAttachment(TENANT, second.id(), first.attachments().getFirst().id()))
            .isInstanceOf(FeedbackNotFoundException.class);
    }

    @Test
    void keepsDiagnosticsWhitelistOnTheRowProjection() {
        FeedbackRecord submitted = service.submit(
            runtimeContext(),
            new FeedbackSubmission(
                FeedbackType.ISSUE, "带诊断", null, null, true,
                new FeedbackDiagnostics("0.1.0", "0.1.7-rc.2", "darwin-arm64", "install-01", "ENT_UPSTREAM_TIMEOUT")
            ),
            null, List.of()
        );

        FeedbackDiagnostics diagnostics = service.detail(TENANT, submitted.id()).diagnostics();
        assertThat(diagnostics.pluginVersion()).isEqualTo("0.1.0");
        assertThat(diagnostics.hostVersion()).isEqualTo("0.1.7-rc.2");
        assertThat(diagnostics.os()).isEqualTo("darwin-arm64");
        assertThat(diagnostics.installationId()).isEqualTo("install-01");
        assertThat(diagnostics.lastErrorCode()).isEqualTo("ENT_UPSTREAM_TIMEOUT");
    }

    private static DeviceCallContext runtimeContext() {
        return new DeviceCallContext(
            TENANT, new PlatformSession(7, PlatformClient.DSH_DESKTOP, "harness", "install-01"),
            "req_test", null, null
        );
    }

    private static FeedbackMutationContext mutation() {
        return new FeedbackMutationContext(TENANT, 9, "req_admin", null, null);
    }

    private static FeedbackSubmission submission(
        FeedbackType type,
        String description,
        Instant occurredAt,
        String contact
    ) {
        return new FeedbackSubmission(type, description, occurredAt, contact, true, FeedbackDiagnostics.EMPTY);
    }

    private static String uuid(long suffix) {
        return "123e4567-e89b-42d3-a456-4266141740%02d".formatted(suffix);
    }

    private static InputStream png(int width, int height) {
        byte[] header = new byte[24];
        System.arraycopy(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, 0, header, 0, 8);
        System.arraycopy(new byte[] {'I', 'H', 'D', 'R'}, 0, header, 12, 4);
        writeInt(header, 16, width);
        writeInt(header, 20, height);
        return new ByteArrayInputStream(header);
    }

    private static void writeInt(byte[] target, int offset, int value) {
        target[offset] = (byte) (value >>> 24);
        target[offset + 1] = (byte) (value >>> 16);
        target[offset + 2] = (byte) (value >>> 8);
        target[offset + 3] = (byte) value;
    }

    /**
     * 内存 FeedbackStore 假实现：模拟 V34 两表的行级 CAS、keyset 倒序与 tenant 隔离语义。
     */
    private static final class FakeFeedbackStore implements FeedbackStore {
        private final Map<Long, FeedbackRecord> records = new LinkedHashMap<>();
        private final Map<Long, List<FeedbackAttachment>> attachments = new LinkedHashMap<>();

        @Override
        public Optional<FeedbackRecord> findById(String tenantId, long feedbackId) {
            FeedbackRecord record = records.get(feedbackId);
            if (record == null || !record.tenantId().equals(tenantId)) return Optional.empty();
            return Optional.of(withAttachments(record));
        }

        @Override
        public Optional<FeedbackRecord> findForUpdate(String tenantId, long feedbackId) {
            return findById(tenantId, feedbackId);
        }

        @Override
        public Optional<FeedbackRecord> findByIdempotencyKey(
            String tenantId,
            long submitterUserId,
            String idempotencyKey
        ) {
            return records.values().stream()
                .filter(record -> record.tenantId().equals(tenantId))
                .filter(record -> record.submitterUserId() == submitterUserId)
                .filter(record -> idempotencyKey.equals(record.idempotencyKey()))
                .findFirst()
                .map(this::withAttachments);
        }

        @Override
        public List<FeedbackRecord> list(String tenantId, FeedbackStatus status, long afterId, int limit) {
            return records.values().stream()
                .filter(record -> record.tenantId().equals(tenantId))
                .filter(record -> status == null || record.status() == status)
                .filter(record -> afterId <= 0 || record.id() < afterId)
                .sorted(Comparator.comparingLong(FeedbackRecord::id).reversed())
                .limit(limit)
                .map(this::withAttachments)
                .toList();
        }

        @Override
        public void insert(FeedbackRecord record, List<FeedbackAttachment> rows) {
            records.put(record.id(), record);
            attachments.put(record.id(), List.copyOf(rows));
        }

        @Override
        public boolean compareAndSetStatus(
            String tenantId,
            long feedbackId,
            long expectedRevision,
            FeedbackStatus target,
            String note,
            long actorId,
            Instant changedAt
        ) {
            FeedbackRecord record = records.get(feedbackId);
            if (record == null || !record.tenantId().equals(tenantId) || record.revision() != expectedRevision) {
                return false;
            }
            records.put(feedbackId, new FeedbackRecord(
                record.id(), record.tenantId(), record.submitterUserId(), record.deviceId(), record.type(),
                record.description(), record.occurredAt(), record.contact(), record.consent(), target, note,
                actorId, changedAt, record.revision() + 1, record.diagnostics(), record.attachmentCount(),
                record.attachments(), record.idempotencyKey(), record.createdAt(), changedAt
            ));
            return true;
        }

        @Override
        public Optional<FeedbackAttachment> findAttachment(String tenantId, long feedbackId, long attachmentId) {
            return attachments.getOrDefault(feedbackId, List.of()).stream()
                .filter(attachment -> attachment.tenantId().equals(tenantId))
                .filter(attachment -> attachment.id() == attachmentId)
                .findFirst();
        }

        private FeedbackRecord withAttachments(FeedbackRecord record) {
            List<FeedbackAttachment> rows = attachments.getOrDefault(record.id(), List.of());
            return new FeedbackRecord(
                record.id(), record.tenantId(), record.submitterUserId(), record.deviceId(), record.type(),
                record.description(), record.occurredAt(), record.contact(), record.consent(), record.status(),
                record.statusNote(), record.statusChangedBy(), record.statusChangedAt(), record.revision(),
                record.diagnostics(), rows.size(), rows, record.idempotencyKey(), record.createdAt(),
                record.updatedAt()
            );
        }
    }
}
