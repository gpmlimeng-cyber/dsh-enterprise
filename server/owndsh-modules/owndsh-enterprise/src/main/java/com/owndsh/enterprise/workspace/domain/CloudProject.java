/**
 * [INPUT]: 接收 tenant、slug、名称、默认分支与创建者身份事实。
 * [OUTPUT]: 对外提供云端项目聚合根与 ACTIVE 状态。
 * [POS]: workspace/domain 的不可变项目事实；bare 路径由 id 派生，不进入领域构造器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.domain;

import java.time.Instant;
import java.util.Objects;

public record CloudProject(
    long id,
    String tenantId,
    String slug,
    String name,
    String description,
    String defaultBranch,
    long createdBy,
    Status status,
    Instant createdAt,
    Instant updatedAt
) {
    public CloudProject {
        if (id <= 0) throw new IllegalArgumentException("id 必须为正数");
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(slug, "slug");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(defaultBranch, "defaultBranch");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public enum Status {
        ACTIVE, DISABLED
    }
}
