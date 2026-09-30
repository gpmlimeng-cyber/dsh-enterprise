/**
 * [INPUT]: 由冻结处置链路之外的流转请求（跳步、重复、回退）触发。
 * [OUTPUT]: 对外提供 ENT_FEEDBACK_STATE_CONFLICT 稳定错误码与请求的状态对。
 * [POS]: feedback/application 的状态机冲突边界，区别于 revision 并发冲突。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

import com.owndsh.enterprise.feedback.domain.FeedbackStatus;

import java.util.Objects;

public final class FeedbackStateConflictException extends RuntimeException {
    public static final String ERROR_CODE = "ENT_FEEDBACK_STATE_CONFLICT";

    private static final long serialVersionUID = 1L;

    private final FeedbackStatus currentStatus;
    private final FeedbackStatus targetStatus;

    public FeedbackStateConflictException(FeedbackStatus currentStatus, FeedbackStatus targetStatus) {
        super("反馈状态不允许从 " + currentStatus.wireValue() + " 流转到 " + targetStatus.wireValue());
        this.currentStatus = Objects.requireNonNull(currentStatus, "currentStatus");
        this.targetStatus = Objects.requireNonNull(targetStatus, "targetStatus");
    }

    public String errorCode() {
        return ERROR_CODE;
    }

    public FeedbackStatus currentStatus() {
        return currentStatus;
    }

    public FeedbackStatus targetStatus() {
        return targetStatus;
    }
}
