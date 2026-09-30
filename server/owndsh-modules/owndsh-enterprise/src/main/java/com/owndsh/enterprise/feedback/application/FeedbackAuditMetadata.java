/**
 * [INPUT]: 依赖 AuditAction 与反馈处置事实（ID、类型、附件数、前后状态）。
 * [OUTPUT]: 提供两类反馈审计 action 的非敏感 metadata 白名单。
 * [POS]: feedback/application 的审计 DTO；只投影结构化事实，反馈正文、联系方式与 diagnostics 永不进入审计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackType;

public sealed interface FeedbackAuditMetadata extends AuditMetadata {
    /**
     * @param feedbackId 新反馈 ID
     * @param type 反馈类型
     * @param attachmentCount 本次提交的附件数
     */
    record Submitted(long feedbackId, FeedbackType type, int attachmentCount) implements FeedbackAuditMetadata {
        public Submitted {
            if (feedbackId <= 0) throw new IllegalArgumentException("feedbackId 必须为正数");
            if (attachmentCount < 0 || attachmentCount > 3) throw new IllegalArgumentException("附件数非法");
        }

        @Override
        public AuditAction action() {
            return AuditAction.FEEDBACK_SUBMITTED;
        }
    }

    /**
     * @param feedbackId 被处置的反馈 ID
     * @param previousStatus 流转前状态
     * @param currentStatus 流转后状态
     * @param revision 本次流转产生的 revision
     */
    record StatusChanged(
        long feedbackId,
        FeedbackStatus previousStatus,
        FeedbackStatus currentStatus,
        long revision
    ) implements FeedbackAuditMetadata {
        public StatusChanged {
            if (feedbackId <= 0) throw new IllegalArgumentException("feedbackId 必须为正数");
            if (previousStatus == null || currentStatus == null || !previousStatus.canTransitionTo(currentStatus)) {
                throw new IllegalArgumentException("状态流转 metadata 非法");
            }
            if (revision <= 0) throw new IllegalArgumentException("revision 必须为正数");
        }

        @Override
        public AuditAction action() {
            return AuditAction.FEEDBACK_STATUS_CHANGED;
        }
    }
}
