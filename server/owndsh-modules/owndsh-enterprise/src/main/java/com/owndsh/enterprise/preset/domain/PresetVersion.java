/**
 * [INPUT]: 依赖 package 外键、VALIDATED→PUBLISHED→RETIRED 状态机与 manifest 抄下来的引用清单。
 * [OUTPUT]: 提供不可变的配方版本、内容寻址制品事实与 dependencies（引用，非快照）。
 * [POS]: preset/domain 的制品版本真源，不暴露本地 artifact 路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record PresetVersion(
    long id,
    String tenantId,
    long packageId,
    String sourceDshVersion,
    String artifactRef,
    long sizeBytes,
    String sha256,
    List<PresetDependency> dependencies,
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
        // 上传即冻结：引用清单是版本内不可变副本，不存在就地修改已存在版本行的写路径。
        dependencies = List.copyOf(Objects.requireNonNull(dependencies, "dependencies"));
    }
}
