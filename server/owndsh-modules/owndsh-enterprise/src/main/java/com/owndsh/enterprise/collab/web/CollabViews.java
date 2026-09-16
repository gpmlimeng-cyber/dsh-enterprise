/**
 * [INPUT]: 依赖 collab application 的 ProjectRow/MemberRow/MessageRow。
 * [OUTPUT]: 对外提供字符串化 snowflake 的严格 HTTP 投影。
 * [POS]: collab/web 的输出边界；不投影消息以外的内部 SQL 形状。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.web;

import com.owndsh.enterprise.collab.persistence.CollabStore.MemberRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.MessageRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.ProjectRow;

import java.util.List;

public final class CollabViews {
    private CollabViews() {
    }

    public record ProjectView(
        String id,
        String name,
        String ownerUserId,
        String status,
        String createdAt,
        String updatedAt
    ) {
    }

    public record MemberView(String userId, String role, String joinedAt) {
    }

    public record ProjectDetailView(ProjectView project, List<MemberView> members) {
    }

    public record MessageView(
        String id,
        String projectId,
        long serverSeq,
        String authorUserId,
        String kind,
        String body,
        String targetSessionId,
        Long targetSeq,
        String createdAt
    ) {
    }

    public static ProjectView project(ProjectRow row) {
        return new ProjectView(
            Long.toString(row.id()),
            row.name(),
            Long.toString(row.ownerUserId()),
            row.status(),
            row.createdAt().toString(),
            row.updatedAt().toString()
        );
    }

    public static ProjectDetailView detail(ProjectRow project, List<MemberRow> members) {
        return new ProjectDetailView(
            project(project),
            members.stream().map(CollabViews::member).toList()
        );
    }

    public static MemberView member(MemberRow row) {
        return new MemberView(
            Long.toString(row.userId()),
            row.role(),
            row.joinedAt().toString()
        );
    }

    public static MessageView message(MessageRow row) {
        return new MessageView(
            Long.toString(row.id()),
            Long.toString(row.projectId()),
            row.serverSeq(),
            Long.toString(row.authorUserId()),
            row.kind(),
            row.body(),
            row.targetSessionId(),
            row.targetSeq(),
            row.createdAt().toString()
        );
    }
}
