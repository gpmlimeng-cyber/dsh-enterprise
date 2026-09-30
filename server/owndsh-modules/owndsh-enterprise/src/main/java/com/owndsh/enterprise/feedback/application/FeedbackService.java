/**
 * [INPUT]: 依赖事务、FeedbackStore、CAS 附件库、位图 inspector、审计、ID 与时钟。
 * [OUTPUT]: 提供员工提交、管理端 keyset 列表/详情、状态流转与授权附件流。
 * [POS]: feedback/application 的状态编排；提交者与宿主 installation 只来自可信会话，diagostics 只按白名单列落库。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.feedback.artifact.FeedbackAttachmentStore;
import com.owndsh.enterprise.feedback.artifact.FeedbackImageInspector;
import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackSubmission;
import com.owndsh.enterprise.feedback.domain.FeedbackValidationException;
import com.owndsh.enterprise.feedback.persistence.FeedbackStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionOperations;

import java.io.InputStream;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.LongSupplier;

/**
 * 问题反馈应用服务。
 */
public final class FeedbackService {
    /** 处置备注上限，与 ent_feedback.status_note varchar(500) 同构。 */
    public static final int MAX_NOTE_LENGTH = 500;

    private final TransactionOperations transactions;
    private final FeedbackStore feedback;
    private final FeedbackAttachmentStore artifacts;
    private final FeedbackImageInspector inspector;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public FeedbackService(
        TransactionOperations transactions,
        FeedbackStore feedback,
        FeedbackAttachmentStore artifacts,
        FeedbackImageInspector inspector,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, feedback, artifacts, inspector, auditSink, ids, Clock.systemUTC());
    }

    FeedbackService(
        TransactionOperations transactions,
        FeedbackStore feedback,
        FeedbackAttachmentStore artifacts,
        FeedbackImageInspector inspector,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.feedback = Objects.requireNonNull(feedback, "feedback");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * 员工提交。附件先落 CAS，再在单个事务内写主行与附件行；idempotencyKey 非空时重放返回既有行。
     */
    public FeedbackRecord submit(
        DeviceCallContext context,
        FeedbackSubmission submission,
        String idempotencyKey,
        List<InputStream> attachments
    ) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(submission, "submission");
        List<InputStream> uploads = List.copyOf(Objects.requireNonNull(attachments, "attachments"));
        if (uploads.size() > FeedbackSubmission.MAX_ATTACHMENTS) {
            throw new FeedbackValidationException(
                "附件最多 " + FeedbackSubmission.MAX_ATTACHMENTS + " 个"
            );
        }
        String key = normalizeKey(idempotencyKey);
        if (key != null) {
            Optional<FeedbackRecord> replayed = requireResult(transactions.execute(
                status -> feedback.findByIdempotencyKey(context.tenantId(), context.session().userId(), key)
            ));
            if (replayed.isPresent()) return replayed.get();
        }
        Instant now = Instant.now(clock);
        long submitter = context.session().userId();
        List<StoredAttachment> stored = store(uploads);        try {
            return requireResult(transactions.execute(status -> {
                long feedbackId = positiveId();
                List<FeedbackAttachment> rows = new ArrayList<>(stored.size());
                for (StoredAttachment item : stored) {
                    rows.add(new FeedbackAttachment(
                        positiveId(), context.tenantId(), feedbackId, item.seq(), item.artifactRef(),
                        item.sha256(), item.contentType(), item.extension(), item.sizeBytes(),
                        item.width(), item.height(), now
                    ));
                }
                FeedbackRecord record = new FeedbackRecord(
                    feedbackId, context.tenantId(), submitter, context.session().deviceId(),
                    submission.type(), submission.description(),
                    submission.occurredAt() == null ? now : submission.occurredAt(),
                    submission.contact(), submission.consent(), FeedbackStatus.NEW, null, null, null,
                    0, submission.diagnostics(), rows.size(), rows, key, now, now
                );
                feedback.insert(record, rows);
                auditSink.append(new AuditEvent(
                    positiveId(), context.tenantId(), now, AuditActorType.USER, submitter, null,
                    AuditAction.FEEDBACK_SUBMITTED, "FEEDBACK", Long.toString(feedbackId),
                    AuditResult.SUCCESS, null, context.requestId(), context.sourceIp(),
                    context.userAgentHash(),
                    new FeedbackAuditMetadata.Submitted(feedbackId, submission.type(), rows.size())
                ));
                return record;
            }));
        } catch (DataIntegrityViolationException exception) {
            // 并发同键提交：唯一索引兜底，重放返回已存在的行。
            if (key == null) throw exception;
            return requireResult(transactions.execute(status -> feedback
                .findByIdempotencyKey(context.tenantId(), submitter, key)
                .orElseThrow(() -> exception)));
        }
    }

    public FeedbackPage list(String tenantId, FeedbackStatus status, long afterId, int limit) {
        List<FeedbackRecord> fetched = requireResult(
            transactions.execute(value -> feedback.list(tenantId, status, afterId, limit + 1))
        );
        boolean hasMore = fetched.size() > limit;
        return new FeedbackPage(hasMore ? List.copyOf(fetched.subList(0, limit)) : fetched, hasMore);
    }

    public FeedbackRecord detail(String tenantId, long feedbackId) {
        return requireResult(transactions.execute(
            status -> feedback.findById(tenantId, feedbackId).orElseThrow(FeedbackNotFoundException::new)
        ));
    }

    /**
     * 管理端状态流转：先按冻结链路校验目标状态，再用 revision CAS 落库并写审计。
     */
    public FeedbackRecord changeStatus(
        FeedbackMutationContext context,
        long feedbackId,
        long expectedRevision,
        FeedbackStatus target,
        String note
    ) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(target, "target");
        String normalizedNote = normalizeNote(note);
        return requireResult(transactions.execute(status -> {
            FeedbackRecord current = feedback.findForUpdate(context.tenantId(), feedbackId)
                .orElseThrow(FeedbackNotFoundException::new);
            if (current.revision() != expectedRevision) {
                throw new RevisionConflictException(expectedRevision, current.revision());
            }
            if (!current.status().canTransitionTo(target)) {
                throw new FeedbackStateConflictException(current.status(), target);
            }
            Instant now = Instant.now(clock);
            if (!feedback.compareAndSetStatus(
                context.tenantId(), feedbackId, expectedRevision, target, normalizedNote,
                context.actorId(), now
            )) {
                throw new RevisionConflictException(expectedRevision, current.revision());
            }
            auditSink.append(new AuditEvent(
                positiveId(), context.tenantId(), now, AuditActorType.USER, context.actorId(), null,
                AuditAction.FEEDBACK_STATUS_CHANGED, "FEEDBACK", Long.toString(feedbackId),
                AuditResult.SUCCESS, null, context.requestId(), context.sourceIp(), context.userAgentHash(),
                new FeedbackAuditMetadata.StatusChanged(
                    feedbackId, current.status(), target, current.revision() + 1
                )
            ));
            return feedback.findById(context.tenantId(), feedbackId).orElseThrow(FeedbackNotFoundException::new);
        }));
    }

    /** 附件必须属于该 tenant 的该反馈，否则 404，避免跨记录枚举。 */
    public FeedbackAttachment requireAttachment(String tenantId, long feedbackId, long attachmentId) {
        return requireResult(transactions.execute(status -> feedback
            .findAttachment(tenantId, feedbackId, attachmentId)
            .orElseThrow(FeedbackNotFoundException::new)));
    }

    public Path contentPath(FeedbackAttachment attachment) {
        Objects.requireNonNull(attachment, "attachment");
        return artifacts.resolve(attachment.artifactRef());
    }

    private List<StoredAttachment> store(List<InputStream> uploads) {
        List<StoredAttachment> stored = new ArrayList<>(uploads.size());
        for (int index = 0; index < uploads.size(); index++) {
            FeedbackAttachmentStore.PendingAttachment pending =
                artifacts.writePending(UUID.randomUUID(), uploads.get(index));
            try {
                FeedbackImageInspector.InspectedImage image = inspector.inspect(pending.path());
                try (FeedbackAttachmentStore.AttachmentMutationLock ignored =
                         artifacts.lockForMutation(pending)) {
                    FeedbackAttachmentStore.StoredAttachment finalized = artifacts.finalizeAttachment(pending);
                    stored.add(new StoredAttachment(
                        index + 1, finalized.artifactRef(), finalized.sha256(), image.contentType(),
                        image.extension(), finalized.sizeBytes(), image.width(), image.height()
                    ));
                }
            } finally {
                artifacts.deletePending(pending);
            }
        }
        return stored;
    }

    private static String normalizeKey(String idempotencyKey) {
        if (idempotencyKey == null) return null;
        String normalized = idempotencyKey.strip().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) return null;
        if (!normalized.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) {
            throw new FeedbackValidationException("Idempotency-Key 必须是 UUID");
        }
        return normalized;
    }

    private static String normalizeNote(String note) {
        if (note == null) return null;
        String normalized = note.strip();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > MAX_NOTE_LENGTH) {
            throw new FeedbackValidationException("处置备注超过 " + MAX_NOTE_LENGTH + " 字上限");
        }
        return normalized;
    }

    private long positiveId() {
        long id = ids.getAsLong();
        if (id <= 0) throw new IllegalStateException("ID 必须为正数");
        return id;
    }

    private static <T> T requireResult(T value) {
        return Objects.requireNonNull(value, "transaction result");
    }

    public record FeedbackPage(List<FeedbackRecord> items, boolean hasMore) {
    }

    private record StoredAttachment(
        int seq,
        String artifactRef,
        String sha256,
        String contentType,
        String extension,
        long sizeBytes,
        int width,
        int height
    ) {
    }
}
