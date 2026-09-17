/**
 * [INPUT]: 依赖一次成功云端项目创建的 slug 与创建者角色事实。
 * [OUTPUT]: 对外提供 CLOUD_PROJECT_CREATED 审计允许的 slug/role 白名单字段。
 * [POS]: workspace 与 audit 的显式 DTO 接缝，不复制仓库路径、文件内容或请求 Map。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.audit;

/**
 * 云端项目创建审计 metadata。
 *
 * @param slug 项目标识
 * @param role 创建者角色
 */
public record CloudProjectCreatedMetadata(String slug, String role) implements AuditMetadata {
    public CloudProjectCreatedMetadata {
        if (slug == null || slug.isBlank() || role == null || role.isBlank()) {
            throw new IllegalArgumentException("slug 与 role 不能为空");
        }
    }

    @Override
    public AuditAction action() {
        return AuditAction.CLOUD_PROJECT_CREATED;
    }
}
