/**
 * [INPUT]: 依赖内容寻址存储的 artifact_ref/hash 与位图 inspector 的 MIME/尺寸事实。
 * [OUTPUT]: 对外提供反馈附件的持久化事实与文件名扩展名投影。
 * [POS]: feedback/domain 的附件值对象；只描述已校验入库的位图，不暴露本地路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import java.time.Instant;
import java.util.Objects;

public record FeedbackAttachment(
    long id,
    String tenantId,
    long feedbackId,
    int seq,
    String artifactRef,
    String sha256,
    String contentType,
    String extension,
    long sizeBytes,
    int width,
    int height,
    Instant createdAt
) {
    public FeedbackAttachment {
        if (id <= 0 || feedbackId <= 0) throw new IllegalArgumentException("附件 ID 必须为正数");
        Objects.requireNonNull(tenantId, "tenantId");
        if (seq < 1 || seq > FeedbackSubmission.MAX_ATTACHMENTS) {
            throw new IllegalArgumentException("附件序号必须在 1.." + FeedbackSubmission.MAX_ATTACHMENTS);
        }
        Objects.requireNonNull(artifactRef, "artifactRef");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(createdAt, "createdAt");
        if (contentType == null || extension == null) throw new IllegalArgumentException("附件 MIME 与扩展名不能为空");
        if (sizeBytes <= 0) throw new IllegalArgumentException("附件大小必须为正数");
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("附件尺寸必须为正数");
    }
}
