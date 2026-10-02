/**
 * [INPUT]: 依赖已发布且对当前用户可见的 package/version 联合投影与其 dependencies 引用清单。
 * [OUTPUT]: 提供 runtime 浏览摘要与详情事实（含引用清单，供员工端启用前清单）。
 * [POS]: preset/domain 的员工只读模型，不含 artifact 路径与管理集合。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.time.Instant;
import java.util.List;
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
    Instant updatedAt,
    List<PresetDependency> dependencies
) {
    public RuntimePreset {
        Objects.requireNonNull(presetId, "presetId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(sourceDshVersion, "sourceDshVersion");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(updatedAt, "updatedAt");
        dependencies = List.copyOf(Objects.requireNonNull(dependencies, "dependencies"));
    }
}
