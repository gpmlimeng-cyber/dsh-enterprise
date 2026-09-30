/**
 * [INPUT]: 依赖 ent_feedback 行事实、白名单 diagnostics 与附件行；不接受 Controller 请求对象。
 * [OUTPUT]: 对外提供完整的反馈聚合，列表投影用 attachmentCount 表达附件数、attachments 为空列表。
 * [POS]: feedback/domain 的唯一聚合真源；提交者与 installation 由服务端会话填入，不来自请求体。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 反馈聚合。列表查询返回 attachmentCount 且 attachments 为空；详情查询同时填充两者。
 */
public record FeedbackRecord(
    long id,
    String tenantId,
    long submitterUserId,
    String deviceId,
    FeedbackType type,
    String description,
    Instant occurredAt,
    String contact,
    boolean consent,
    FeedbackStatus status,
    String statusNote,
    Long statusChangedBy,
    Instant statusChangedAt,
    long revision,
    FeedbackDiagnostics diagnostics,
    int attachmentCount,
    List<FeedbackAttachment> attachments,
    String idempotencyKey,
    Instant createdAt,
    Instant updatedAt
) {
    public FeedbackRecord {
        if (id <= 0 || submitterUserId <= 0) throw new IllegalArgumentException("反馈与提交者 ID 必须为正数");
        requireText(tenantId, "tenantId");
        requireText(deviceId, "deviceId");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        // 同意与描述上限是数据库约束的同构前置条件，聚合不允许出现违约状态。
        if (!consent) throw new IllegalArgumentException("反馈必须记录同意事实");
        if (description == null || description.isBlank()
            || description.length() > FeedbackSubmission.MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("反馈描述不满足 1.." + FeedbackSubmission.MAX_DESCRIPTION_LENGTH);
        }
        if (revision < 0) throw new IllegalArgumentException("revision 不能为负数");
        diagnostics = diagnostics == null ? FeedbackDiagnostics.EMPTY : diagnostics;
        attachments = List.copyOf(Objects.requireNonNull(attachments, "attachments"));
        if (attachmentCount < 0 || attachmentCount > FeedbackSubmission.MAX_ATTACHMENTS) {
            throw new IllegalArgumentException("附件数超出 0.." + FeedbackSubmission.MAX_ATTACHMENTS);
        }
        if (!attachments.isEmpty() && attachmentCount != attachments.size()) {
            throw new IllegalArgumentException("attachmentCount 与附件行不一致");
        }
        if (status == FeedbackStatus.NEW) {
            if (statusNote != null || statusChangedBy != null || statusChangedAt != null) {
                throw new IllegalArgumentException("NEW 反馈不能带处置痕迹");
            }
        } else if (statusChangedBy == null || statusChangedAt == null) {
            throw new IllegalArgumentException("已处置反馈必须记录处置人与时间");
        }
    }

    private static void requireText(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " 不能为空");
    }
}
