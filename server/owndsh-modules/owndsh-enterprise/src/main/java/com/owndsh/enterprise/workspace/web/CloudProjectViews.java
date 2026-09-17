/**
 * [INPUT]: 投影 CloudProject 与成员角色到字符串 ID 的 runtime 视图。
 * [OUTPUT]: 对外提供 id/slug/name/description/defaultBranch/role/cloneUrl，不暴露磁盘路径。
 * [POS]: workspace/web 的安全投影；cloneUrl 由 publicBase + 固定 git 前缀派生。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import com.owndsh.enterprise.workspace.application.CloudWorkspaceService;
import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;

import java.net.URI;
import java.time.Instant;

public final class CloudProjectViews {
    private CloudProjectViews() {
    }

    public static View view(
        CloudWorkspaceService.MemberProject memberProject,
        URI publicBaseUrl
    ) {
        CloudProject project = memberProject.project();
        return new View(
            Long.toString(project.id()),
            project.slug(),
            project.name(),
            project.description(),
            project.defaultBranch(),
            memberProject.role().name(),
            cloneUrl(publicBaseUrl, project.id()),
            project.createdAt(),
            project.updatedAt()
        );
    }

    public static MemberView member(CloudProjectMember member) {
        return new MemberView(
            Long.toString(member.userId()),
            member.role().name(),
            member.createdAt()
        );
    }

    public static String cloneUrl(URI publicBaseUrl, long projectId) {
        if (publicBaseUrl == null) {
            return "/enterprise/api/v1/git/" + projectId + ".git";
        }
        String base = publicBaseUrl.toString();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/enterprise/api/v1/git/" + projectId + ".git";
    }

    public record View(
        String id,
        String slug,
        String name,
        String description,
        String defaultBranch,
        String role,
        String cloneUrl,
        Instant createdAt,
        Instant updatedAt
    ) {
    }

    public record MemberView(String userId, String role, Instant createdAt) {
    }
}
