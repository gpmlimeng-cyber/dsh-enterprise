/**
 * [INPUT]: 表达 Git bare 仓库文件系统边界上的可预期失败。
 * [OUTPUT]: 对外提供不携带磁盘路径正文的运行时异常包装。
 * [POS]: workspace/git 的内部失败信号，由服务层翻译为 CloudWorkspaceException。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.git;

public final class CloudWorkspaceGitException extends RuntimeException {
    public CloudWorkspaceGitException(String message) {
        super(message);
    }

    public CloudWorkspaceGitException(String message, Throwable cause) {
        super(message, cause);
    }
}
