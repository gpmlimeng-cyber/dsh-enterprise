/**
 * [INPUT]: 依赖反馈 domain 的 wire/database 双向映射、诊断白名单与冻结处置链路。
 * [OUTPUT]: 验证类型/状态映射、非法流转拒绝、描述与同意校验、诊断格式收窄与聚合不变量。
 * [POS]: feedback/domain 的纯 JVM 输入闸门，不依赖 PostgreSQL、文件系统或 Spring。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class FeedbackDomainTest {

    @Test
    void mapsTypeAndStatusBetweenWireAndDatabaseValues() {
        assertThat(FeedbackType.fromWire(null)).isEqualTo(FeedbackType.ISSUE);
        assertThat(FeedbackType.fromWire("suggestion")).isEqualTo(FeedbackType.SUGGESTION);
        assertThat(FeedbackType.ISSUE.databaseValue()).isEqualTo("ISSUE");
        assertThat(FeedbackType.fromDatabase("SUGGESTION")).isEqualTo(FeedbackType.SUGGESTION);
        assertThat(FeedbackStatus.fromWire("triaged")).isEqualTo(FeedbackStatus.TRIAGED);
        assertThat(FeedbackStatus.RESOLVED.databaseValue()).isEqualTo("RESOLVED");
        assertThat(FeedbackStatus.fromDatabase("IGNORED")).isEqualTo(FeedbackStatus.IGNORED);

        assertThatThrownBy(() -> FeedbackType.fromWire("bug"))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("issue");
        assertThatThrownBy(() -> FeedbackStatus.fromWire(null))
            .isInstanceOf(FeedbackValidationException.class);
    }

    @Test
    void allowsOnlyTheFrozenTriageChain() {
        assertThat(FeedbackStatus.NEW.canTransitionTo(FeedbackStatus.TRIAGED)).isTrue();
        assertThat(FeedbackStatus.NEW.canTransitionTo(FeedbackStatus.RESOLVED)).isFalse();
        assertThat(FeedbackStatus.NEW.canTransitionTo(FeedbackStatus.IGNORED)).isFalse();
        assertThat(FeedbackStatus.TRIAGED.canTransitionTo(FeedbackStatus.RESOLVED)).isTrue();
        assertThat(FeedbackStatus.TRIAGED.canTransitionTo(FeedbackStatus.IGNORED)).isTrue();
        assertThat(FeedbackStatus.RESOLVED.terminal()).isTrue();
        assertThat(FeedbackStatus.RESOLVED.canTransitionTo(FeedbackStatus.IGNORED)).isFalse();
        assertThat(FeedbackStatus.NEW.canTransitionTo(FeedbackStatus.NEW)).isFalse();
        assertThat(FeedbackStatus.NEW.canTransitionTo(null)).isFalse();
    }

    @Test
    void requiresConsentBoundedDescriptionAndParseableContact() {
        assertThat(submission("问题描述", true, "dev@example.org").description()).isEqualTo("问题描述");
        assertThat(submission("x".repeat(510), true, "138 0000 0000").description()).hasSize(510);
        assertThat(submission("问题描述", true, "  ").contact()).isNull();

        assertThatThrownBy(() -> submission("问题描述", false, null))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("同意");
        assertThatThrownBy(() -> submission("   ", true, null))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("不能为空");
        assertThatThrownBy(() -> submission("x".repeat(511), true, null))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("510");
        assertThatThrownBy(() -> submission("问题描述", true, "not-a-contact"))
            .isInstanceOf(FeedbackValidationException.class)
            .hasMessageContaining("邮箱或手机号");
    }

    @Test
    void trimsDiagnosticsByWhitelistAndRejectsTokenPathOrFreeText() {
        FeedbackDiagnostics diagnostics = new FeedbackDiagnostics(
            " 0.1.0 ", "0.1.7-rc.2", "darwin-arm64", "install-01", "ENT_UPSTREAM_TIMEOUT"
        );
        assertThat(diagnostics.pluginVersion()).isEqualTo("0.1.0");
        assertThat(diagnostics.lastErrorCode()).isEqualTo("ENT_UPSTREAM_TIMEOUT");
        assertThat(new FeedbackDiagnostics("  ", null, null, null, null).empty()).isTrue();

        // 路径、空白分隔的自由文本与小写错误码都不像合法诊断值，一律 fail-closed。
        assertThatThrownBy(() -> new FeedbackDiagnostics("C:\\Users\\me\\dsh", null, null, null, null))
            .isInstanceOf(FeedbackValidationException.class);
        assertThatThrownBy(() -> new FeedbackDiagnostics(null, "host 0.1.0", null, null, null))
            .isInstanceOf(FeedbackValidationException.class);
        assertThatThrownBy(() -> new FeedbackDiagnostics(null, null, "/home/me/.dsh", null, null))
            .isInstanceOf(FeedbackValidationException.class);
        assertThatThrownBy(() -> new FeedbackDiagnostics(null, null, null, "install/01", null))
            .isInstanceOf(FeedbackValidationException.class);
        assertThatThrownBy(() -> new FeedbackDiagnostics(null, null, null, null, "ent_timeout"))
            .isInstanceOf(FeedbackValidationException.class);
        assertThatThrownBy(() -> new FeedbackDiagnostics("x".repeat(65), null, null, null, null))
            .isInstanceOf(FeedbackValidationException.class);
    }

    @Test
    void keepsAggregateInvariantsAlignedWithDatabaseChecks() {
        FeedbackRecord fresh = record(FeedbackStatus.NEW, null, null, null, 0, List.of());
        assertThat(fresh.diagnostics()).isEqualTo(FeedbackDiagnostics.EMPTY);

        assertThatThrownBy(() -> record(FeedbackStatus.NEW, "note", 7L, Instant.EPOCH, 0, List.of()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("NEW");
        assertThatThrownBy(() -> record(FeedbackStatus.TRIAGED, null, null, null, 0, List.of()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("处置人");
        // 列表投影允许 attachmentCount 非零而附件行为空；超过产品上限则连投影都不合法。
        assertThat(record(FeedbackStatus.NEW, null, null, null, 3, List.of()).attachmentCount()).isEqualTo(3);
        assertThatThrownBy(() -> record(FeedbackStatus.NEW, null, null, null, 4, List.of()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("附件数");
        assertThatThrownBy(() -> record(FeedbackStatus.NEW, null, null, null, 1, List.of(), false))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("同意");
    }

    private static FeedbackSubmission submission(String description, boolean consent, String contact) {
        return new FeedbackSubmission(FeedbackType.ISSUE, description, null, contact, consent,
            FeedbackDiagnostics.EMPTY);
    }

    private static FeedbackRecord record(
        FeedbackStatus status,
        String note,
        Long changedBy,
        Instant changedAt,
        int attachmentCount,
        List<FeedbackAttachment> attachments
    ) {
        return record(status, note, changedBy, changedAt, attachmentCount, attachments, true);
    }

    private static FeedbackRecord record(
        FeedbackStatus status,
        String note,
        Long changedBy,
        Instant changedAt,
        int attachmentCount,
        List<FeedbackAttachment> attachments,
        boolean consent
    ) {
        Instant now = Instant.parse("2026-09-30T03:00:00Z");
        return new FeedbackRecord(
            1, "000000", 7, "install-01", FeedbackType.ISSUE, "描述", now, null, consent,
            status, note, changedBy, changedAt, status == FeedbackStatus.NEW ? 0 : 1,
            FeedbackDiagnostics.EMPTY, attachmentCount, attachments, null, now, now
        );
    }
}
