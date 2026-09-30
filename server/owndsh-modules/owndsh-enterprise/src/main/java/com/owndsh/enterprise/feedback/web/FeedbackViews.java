/**
 * [INPUT]: 投影 FeedbackService 的反馈聚合与附件事实。
 * [OUTPUT]: 对外提供提交回执、管理端列表项、详情与附件三组严格 DTO，字符串化雪花 ID 且不含 artifact 路径。
 * [POS]: feedback/web 的唯一安全投影；diagnostics 只按白名单字段输出，附件只输出管理端鉴权 URL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackDiagnostics;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackType;

import java.time.Instant;
import java.util.List;

public final class FeedbackViews {
    private static final String ATTACHMENT_PATH = "/enterprise/admin/v1/feedback/";

    private FeedbackViews() {
    }

    public static Submission submission(FeedbackRecord record) {
        return new Submission(
            Long.toString(record.id()), record.type(), record.status(), record.occurredAt(),
            record.attachmentCount(), record.createdAt()
        );
    }

    public static Item item(FeedbackRecord record) {
        return new Item(
            Long.toString(record.id()), record.type(), record.status(), record.description(),
            record.contact(), Long.toString(record.submitterUserId()), record.attachmentCount(),
            record.occurredAt(), record.revision(), record.statusNote(),
            record.statusChangedBy() == null ? null : Long.toString(record.statusChangedBy()),
            record.statusChangedAt(), record.createdAt(), record.updatedAt()
        );
    }

    public static Detail detail(FeedbackRecord record) {
        Item item = item(record);
        return new Detail(
            item.id(), item.type(), item.status(), item.description(), item.contact(), item.submitterId(),
            item.attachmentCount(), item.occurredAt(), item.revision(), item.statusNote(),
            item.statusChangedBy(), item.statusChangedAt(), item.createdAt(), item.updatedAt(),
            record.diagnostics(), record.attachments().stream().map(FeedbackViews::attachment).toList()
        );
    }

    public static Attachment attachment(FeedbackAttachment attachment) {
        return new Attachment(
            Long.toString(attachment.id()), attachment.seq(),
            ATTACHMENT_PATH + attachment.feedbackId() + "/attachments/" + attachment.id() + "/content",
            attachment.contentType(), attachment.extension(), attachment.sizeBytes(),
            attachment.width(), attachment.height()
        );
    }

    public record Submission(
        String id,
        FeedbackType type,
        FeedbackStatus status,
        Instant occurredAt,
        int attachmentCount,
        Instant createdAt
    ) {
    }

    public record Item(
        String id,
        FeedbackType type,
        FeedbackStatus status,
        String description,
        String contact,
        String submitterId,
        int attachmentCount,
        Instant occurredAt,
        long revision,
        String statusNote,
        String statusChangedBy,
        Instant statusChangedAt,
        Instant createdAt,
        Instant updatedAt
    ) {
    }

    public record Detail(
        String id,
        FeedbackType type,
        FeedbackStatus status,
        String description,
        String contact,
        String submitterId,
        int attachmentCount,
        Instant occurredAt,
        long revision,
        String statusNote,
        String statusChangedBy,
        Instant statusChangedAt,
        Instant createdAt,
        Instant updatedAt,
        FeedbackDiagnostics diagnostics,
        List<Attachment> attachments
    ) {
    }

    public record Attachment(
        String id,
        int seq,
        String url,
        String contentType,
        String extension,
        long sizeBytes,
        int width,
        int height
    ) {
    }
}
