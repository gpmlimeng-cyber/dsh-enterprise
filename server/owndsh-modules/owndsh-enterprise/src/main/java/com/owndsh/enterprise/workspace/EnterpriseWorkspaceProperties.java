/**
 * [INPUT]: 绑定 enterprise.cloud-workspace.enabled/repo-root 部署配置。
 * [OUTPUT]: 对外提供云端工作空间 composition root 所需的强类型配置。
 * [POS]: workspace 模块的部署边界；repo-root 只存 bare 仓库，不接受客户端路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/**
 * 云端工作空间部署配置。
 */
@ConfigurationProperties(prefix = "enterprise.cloud-workspace")
public final class EnterpriseWorkspaceProperties {
    private boolean enabled = true;
    private Path repoRoot;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Path getRepoRoot() {
        return repoRoot;
    }

    public void setRepoRoot(Path repoRoot) {
        this.repoRoot = repoRoot;
    }
}
