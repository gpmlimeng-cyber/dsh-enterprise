/**
 * [INPUT]: 依赖 FeedbackViews/FeedbackSubmissionRequest 与 Jackson 序列化结果。
 * [OUTPUT]: 验证管理端投影只输出鉴权 URL 与白名单字段、不泄露 artifact 路径，以及提交 DTO 的默认类型与时区校验。
 * [POS]: feedback/web 的协议投影门禁，纯 JVM 运行，不启动 MVC 或网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackDiagnostics;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackType;
import com.owndsh.enterprise.feedback.domain.FeedbackValidationException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class FeedbackViewsTest {
    private static final Instant NOW = Instant.parse("2026-09-30T03:00:00Z");

    @Test
    void projectsAttachmentContentUrlWithoutArtifactPathOrHash() {
        JsonMapper json = JsonMapper.builder().build();
        String serialized = json.writeValueAsString(FeedbackViews.detail(record()));

        assertThat(serialized).contains(
            "\"url\":\"/enterprise/admin/v1/feedback/1900000000000000001/attachments/1900000000000000009/content\""
        );
        assertThat(serialized).contains("\"type\":\"issue\"", "\"status\":\"triaged\"");
        assertThat(serialized).contains("\"submitterId\":\"202\"");
        assertThat(serialized).contains("\"lastErrorCode\":\"ENT_UPSTREAM_TIMEOUT\"");
        // artifact_ref、本地路径与内容哈希都不属于协议面。
        assertThat(serialized).doesNotContain("artifactRef", "artifact_ref", "sha256", "/data/", "file:");
    }

    @Test
    void defaultsTypeAndParsesOnlyOffsetAwareOccurredAt() {
        FeedbackSubmissionRequest minimal = new FeedbackSubmissionRequest(
            null, "描述", null, null, Boolean.TRUE, null
        );
        assertThat(minimal.toSubmission().type()).isEqualTo(FeedbackType.ISSUE);
        assertThat(minimal.toSubmission().occurredAt()).isNull();
        assertThat(minimal.toSubmission().diagnostics()).isEqualTo(FeedbackDiagnostics.EMPTY);

        FeedbackSubmissionRequest offset = new FeedbackSubmissionRequest(
            FeedbackType.SUGGESTION, "描述", "2026-09-30T11:00:00+08:00", null, Boolean.TRUE, null
        );
        assertThat(offset.toSubmission().occurredAt()).isEqualTo(NOW);

        assertThatThrownBy(() -> new FeedbackSubmissionRequest(
            null, "描述", "2026-09-30T11:00:00", null, Boolean.TRUE, null
        ).toSubmission())
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("时区");
        assertThatThrownBy(() -> new FeedbackSubmissionRequest(
            null, "描述", null, null, null, null
        ).toSubmission())
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("同意");
    }

    private static FeedbackRecord record() {
        FeedbackAttachment attachment = new FeedbackAttachment(
            1900000000000000009L, "000000", 1900000000000000001L, 1, "sha256:" + "a".repeat(64),
            "a".repeat(64), "image/png", "png", 2048, 640, 480, NOW
        );
        return new FeedbackRecord(
            1900000000000000001L, "000000", 202, "install-01", FeedbackType.ISSUE, "点击导出后崩溃",
            NOW, null, true, FeedbackStatus.TRIAGED, "已确认复现", 101L, NOW, 1,
            new FeedbackDiagnostics("0.1.0", "0.1.7-rc.2", "darwin-arm64", "install-01", "ENT_UPSTREAM_TIMEOUT"),
            1, List.of(attachment), null, NOW, NOW
        );
    }
}
