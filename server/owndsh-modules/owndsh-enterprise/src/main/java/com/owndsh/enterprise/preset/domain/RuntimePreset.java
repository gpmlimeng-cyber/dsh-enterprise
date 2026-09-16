/**
 * [INPUT]: 依赖已发布且对当前用户可见的 package/version 联合投影。
 * [OUTPUT]: 提供 runtime 浏览摘要与详情事实。
 * [POS]: preset/domain 的员工只读模型，不含 artifact 路径与管理集合。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.time.Instant;
import java.util.Objects;

public record RuntimePreset(
    long packageId,
    String presetId,
    String displayName,
    String description,
    long versionId,
    String sourceDshVersion,
    long sizeBytes,
    String sha256,
    Instant updatedAt
) {
    public RuntimePreset {
        Objects.requireNonNull(presetId, "presetId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(sourceDshVersion, "sourceDshVersion");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }
}
