/**
 * [INPUT]: 由未知或非法反馈类型触发。
 * [OUTPUT]: 对外提供携带 ENT_FEEDBACK_INVALID 稳定错误码的领域拒绝。
 * [POS]: feedback/domain 的提交校验边界；消息只描述字段规则，不回显用户正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

public final class FeedbackValidationException extends RuntimeException {
    public static final String ERROR_CODE = "ENT_FEEDBACK_INVALID";

    private static final long serialVersionUID = 1L;

    public FeedbackValidationException(String message) {
        super(message);
    }

    public String errorCode() {
        return ERROR_CODE;
    }
}
