/**
 * [INPUT]: 依赖 package 外键与 VALIDATED→PUBLISHED→RETIRED 状态机。
 * [OUTPUT]: 提供不可变的配方版本与内容寻址制品事实。
 * [POS]: preset/domain 的制品版本真源，不暴露本地 artifact 路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.time.Instant;
import java.util.Objects;

public record PresetVersion(
    long id,
    String tenantId,
    long packageId,
    String sourceDshVersion,
    String artifactRef,
    long sizeBytes,
    String sha256,
    Status status,
    long createdBy,
    Instant createdAt,
    long revision
) {
    public enum Status { VALIDATED, PUBLISHED, RETIRED }

    public PresetVersion {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(sourceDshVersion, "sourceDshVersion");
        Objects.requireNonNull(artifactRef, "artifactRef");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
    }
}
