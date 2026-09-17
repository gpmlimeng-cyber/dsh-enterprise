/**
 * [INPUT]: 依赖 repo-root 受控目录与 JGit bare 初始化/打开。
 * [OUTPUT]: 对外提供 projectId 限定的 bare 仓库创建、存在性与路径解析。
 * [POS]: workspace 的唯一 Git 文件系统边界；禁止把客户端路径拼进 root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.git;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.StoredConfig;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

public final class GitRepositoryService {
    private final Path root;

    public GitRepositoryService(Path root) {
        this.root = Objects.requireNonNull(root, "root").toAbsolutePath().normalize();
        try {
            Files.createDirectories(projectsRoot());
        } catch (IOException exception) {
            throw new IllegalStateException("云端仓库根目录无法初始化", exception);
        }
    }

    public Path projectsRoot() {
        return root.resolve("projects");
    }

    public Path barePath(long projectId) {
        if (projectId <= 0) throw new IllegalArgumentException("projectId 必须为正数");
        return projectsRoot().resolve(projectId + ".git");
    }

    public Path initBare(long projectId, String defaultBranch) {
        Path path = barePath(projectId);
        if (Files.exists(path.resolve("HEAD"))) {
            return path;
        }
        try {
            Files.createDirectories(path);
            try (Git git = Git.init().setBare(true).setDirectory(path.toFile()).call();
                 Repository repository = git.getRepository()) {
                StoredConfig config = repository.getConfig();
                config.setString("init", null, "defaultBranch", defaultBranch);
                config.save();
            }
            return path;
        } catch (Exception exception) {
            throw new CloudWorkspaceGitException("bare 仓库创建失败", exception);
        }
    }

    public Repository open(long projectId) {
        Path path = barePath(projectId);
        if (!Files.isDirectory(path)) {
            throw new CloudWorkspaceGitException("bare 仓库不存在");
        }
        try {
            return new org.eclipse.jgit.internal.storage.file.FileRepository(path.toFile());
        } catch (IOException exception) {
            throw new CloudWorkspaceGitException("bare 仓库无法打开", exception);
        }
    }

    public static String defaultBranchOrDefault(String candidate) {
        String value = candidate == null || candidate.isBlank() ? "main" : candidate.trim();
        if (!value.matches("^[A-Za-z0-9][A-Za-z0-9._/-]{0,62}$")) {
            throw new IllegalArgumentException("defaultBranch 非法");
        }
        return value;
    }

    public static String resolveHeadBranch(Repository repository) throws IOException {
        String head = repository.getFullBranch();
        if (head != null && head.startsWith(Constants.R_HEADS)) {
            return head.substring(Constants.R_HEADS.length());
        }
        return "main";
    }
}
