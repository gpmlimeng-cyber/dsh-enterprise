/**
 * [INPUT]: 依赖被移除成员的用户标识。
 * [OUTPUT]: 对外提供 CLOUD_PROJECT_MEMBER_REMOVED 审计允许的 userId 白名单字段。
 * [POS]: workspace 与 audit 的显式 DTO 接缝，不携带成员展示名或身份源细节。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.audit;

/**
 * 云端项目成员移除审计 metadata。
 *
 * @param userId 目标成员 ID
 */
public record CloudProjectMemberRemovedMetadata(long userId) implements AuditMetadata {
    public CloudProjectMemberRemovedMetadata {
        if (userId <= 0) throw new IllegalArgumentException("userId 必须为正数");
    }

    @Override
    public AuditAction action() {
        return AuditAction.CLOUD_PROJECT_MEMBER_REMOVED;
    }
}
