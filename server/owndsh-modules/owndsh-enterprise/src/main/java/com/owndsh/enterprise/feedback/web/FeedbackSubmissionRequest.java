/**
 * [INPUT]: 接收 multipart metadata part 的产品字段与白名单 diagnostics。
 * [OUTPUT]: 对外提供转换为 FeedbackSubmission 的严格请求 DTO，并把 type/occurredAt 缺省与格式错误收敛为稳定错误码。
 * [POS]: feedback/web 的提交请求边界；不接受提交者、installation、状态或任意扩展字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import com.owndsh.enterprise.feedback.domain.FeedbackDiagnostics;
import com.owndsh.enterprise.feedback.domain.FeedbackSubmission;
import com.owndsh.enterprise.feedback.domain.FeedbackType;
import com.owndsh.enterprise.feedback.domain.FeedbackValidationException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

public record FeedbackSubmissionRequest(
    FeedbackType type,
    String description,
    String occurredAt,
    String contact,
    Boolean consent,
    FeedbackDiagnostics diagnostics
) {
    public FeedbackSubmission toSubmission() {
        return new FeedbackSubmission(
            type == null ? FeedbackType.ISSUE : type,
            description,
            parseOccurredAt(occurredAt),
            contact,
            Boolean.TRUE.equals(consent),
            diagnostics
        );
    }

    /** 只接受带时区的 ISO-8601；无时区的本地时间会被拒绝，避免服务端猜测部署时区。 */
    private static Instant parseOccurredAt(String value) {
        if (value == null) return null;
        String normalized = value.strip();
        if (normalized.isEmpty()) return null;
        try {
            return OffsetDateTime.parse(normalized).toInstant();
        } catch (DateTimeParseException exception) {
            throw new FeedbackValidationException("occurredAt 必须是带时区的 ISO-8601 时间");
        }
    }
}
