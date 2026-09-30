/**
 * [INPUT]: 由反馈主行或附件在目标 tenant 下不存在时抛出。
 * [OUTPUT]: 对外提供统一 ENT_RESOURCE_NOT_FOUND 语义的领域异常。
 * [POS]: feedback/application 的 404 边界；跨 tenant 枚举与真实不存在共用同一响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

public final class FeedbackNotFoundException extends RuntimeException {
    public static final String ERROR_CODE = "ENT_RESOURCE_NOT_FOUND";

    private static final long serialVersionUID = 1L;

    public FeedbackNotFoundException() {
        super("反馈资源不存在");
    }
}
