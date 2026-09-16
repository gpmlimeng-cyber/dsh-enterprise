/**
 * [INPUT]: 表达协作信道可预期的开关、项目治理与消息校验失败。
 * [OUTPUT]: 对外提供封闭 Kind 与稳定 ENT_COLLAB/ENT_PROJECT_* 错误码。
 * [POS]: collab application 到统一异常处理器的错误边界，不携带消息正文、SQL 或内部异常。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.application;

public final class CollabException extends RuntimeException {
    private final Kind kind;

    public CollabException(Kind kind) {
        super(kind.name());
        this.kind = java.util.Objects.requireNonNull(kind, "kind");
    }

    public Kind kind() {
        return kind;
    }

    public String errorCode() {
        return kind.errorCode;
    }

    public enum Kind {
        DISABLED("ENT_COLLAB_DISABLED"),
        PROJECT_NOT_FOUND("ENT_PROJECT_NOT_FOUND"),
        NOT_OWNER("ENT_PROJECT_NOT_OWNER"),
        LAST_OWNER("ENT_PROJECT_LAST_OWNER"),
        MEMBER_EXISTS("ENT_PROJECT_MEMBER_EXISTS"),
        MEMBER_NOT_FOUND("ENT_PROJECT_MEMBER_NOT_FOUND"),
        INVALID("ENT_INVALID_REQUEST");

        private final String errorCode;

        Kind(String errorCode) {
            this.errorCode = errorCode;
        }

        public String errorCode() {
            return errorCode;
        }
    }
}
