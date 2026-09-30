/**
 * [INPUT]: 依赖 tenant、organization_id 预留列与乐观 revision。
 * [OUTPUT]: 提供单行品牌配置的当前发布 revision 与最近修改人事实。
 * [POS]: branding/domain 的配置指针真源；全局单例由 organization_id is null 的数据库局部唯一索引保证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public record BrandingConfig(
    long id,
    String tenantId,
    Long organizationId,
    long revision,
    Long updatedBy,
    Instant updatedAt
) {
    public BrandingConfig {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (revision < 0) throw new IllegalArgumentException("revision 不能为负数");
    }

    public Optional<Long> organization() {
        return Optional.ofNullable(organizationId);
    }
}
