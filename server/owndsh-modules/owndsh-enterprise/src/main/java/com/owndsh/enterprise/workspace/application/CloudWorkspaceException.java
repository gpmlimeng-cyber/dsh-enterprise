/**
 * [INPUT]: 表达云端工作空间可预期的禁用、冲突、未找到、权限与成员治理失败。
 * [OUTPUT]: 对外提供封闭 Kind 与稳定错误码，不携带路径、SQL 或仓库正文。
 * [POS]: workspace application 到 EnterpriseExceptionHandler 的错误边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.application;

public final class CloudWorkspaceException extends RuntimeException {
    private final Kind kind;

    public CloudWorkspaceException(Kind kind) {
        super(kind.name());
        this.kind = java.util.Objects.requireNonNull(kind, "kind");
    }

    public CloudWorkspaceException(Kind kind, String detail) {
        super(kind.name() + ":" + detail);
        this.kind = java.util.Objects.requireNonNull(kind, "kind");
    }

    public Kind kind() {
        return kind;
    }

    public String errorCode() {
        return kind.errorCode;
    }

    public enum Kind {
        DISABLED("ENT_WORKSPACE_DISABLED"),
        NOT_FOUND("ENT_RESOURCE_NOT_FOUND"),
        FORBIDDEN("ENT_WORKSPACE_FORBIDDEN"),
        SLUG_CONFLICT("ENT_WORKSPACE_SLUG_CONFLICT"),
        NOT_MAPPED("ENT_WORKSPACE_NOT_MAPPED"),
        LAST_OWNER("ENT_WORKSPACE_LAST_OWNER"),
        INVALID_REQUEST("ENT_INVALID_REQUEST"),
        GIT_UNAVAILABLE("ENT_GIT_UNAVAILABLE");

        private final String errorCode;

        Kind(String errorCode) {
            this.errorCode = errorCode;
        }

        public String errorCode() {
            return errorCode;
        }
    }
}
