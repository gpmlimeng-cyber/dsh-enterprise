/**
 * [INPUT]: 接收项目 ID、用户 ID 与封闭角色。
 * [OUTPUT]: 对外提供云端项目成员事实。
 * [POS]: workspace/domain 的成员关系，与 Git 读写授权一一对应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.domain;

import java.time.Instant;
import java.util.Objects;

public record CloudProjectMember(
    long projectId,
    long userId,
    Role role,
    Instant createdAt
) {
    public CloudProjectMember {
        if (projectId <= 0) throw new IllegalArgumentException("projectId 必须为正数");
        if (userId <= 0) throw new IllegalArgumentException("userId 必须为正数");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    public enum Role {
        OWNER, MEMBER
    }
}
