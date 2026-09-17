/**
 * [INPUT]: 依赖被加入成员的用户标识与角色。
 * [OUTPUT]: 对外提供 CLOUD_PROJECT_MEMBER_ADDED 审计允许的 userId/role 白名单字段。
 * [POS]: workspace 与 audit 的显式 DTO 接缝，不携带成员展示名或身份源细节。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.audit;

/**
 * 云端项目成员加入审计 metadata。
 *
 * @param userId 目标成员 ID
 * @param role 分配角色
 */
public record CloudProjectMemberAddedMetadata(long userId, String role) implements AuditMetadata {
    public CloudProjectMemberAddedMetadata {
        if (userId <= 0) throw new IllegalArgumentException("userId 必须为正数");
        if (role == null || role.isBlank()) throw new IllegalArgumentException("role 不能为空");
    }

    @Override
    public AuditAction action() {
        return AuditAction.CLOUD_PROJECT_MEMBER_ADDED;
    }
}
