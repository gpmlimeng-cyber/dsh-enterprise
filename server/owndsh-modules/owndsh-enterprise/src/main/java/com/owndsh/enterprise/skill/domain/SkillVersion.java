/**
 * [INPUT]: 依赖 package 外键与 VALIDATED→PUBLISHED→RETIRED 状态机。
 * [OUTPUT]: 提供不可变的技能包版本、内容寻址制品与 SKILL.md frontmatter 脱敏投影。
 * [POS]: skill/domain 的制品版本真源，不暴露本地 artifact 路径与技能正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record SkillVersion(
    long id,
    String tenantId,
    long packageId,
    String skillId,
    String sourceDshVersion,
    String artifactRef,
    long sizeBytes,
    String sha256,
    Status status,
    int skillCount,
    List<SkillEntry> skills,
    long createdBy,
    Instant createdAt,
    long revision
) {
    public enum Status { VALIDATED, PUBLISHED, RETIRED }

    public SkillVersion {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(skillId, "skillId");
        Objects.requireNonNull(sourceDshVersion, "sourceDshVersion");
        Objects.requireNonNull(artifactRef, "artifactRef");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        skills = List.copyOf(Objects.requireNonNull(skills, "skills"));
        if (skillCount != skills.size()) throw new IllegalArgumentException("skillCount 必须等于 skills 条目数");
    }
}
