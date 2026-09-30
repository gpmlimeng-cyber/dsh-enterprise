/**
 * [INPUT]: 依赖已发布且对当前用户可见的 package/version 联合投影。
 * [OUTPUT]: 提供 runtime 浏览摘要与详情事实（含包内技能条目）。
 * [POS]: skill/domain 的员工只读模型，不含 artifact 路径与管理集合。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record RuntimeSkill(
    long packageId,
    String skillId,
    String displayName,
    String description,
    long versionId,
    String sourceDshVersion,
    long sizeBytes,
    String sha256,
    List<SkillEntry> skills,
    Instant updatedAt
) {
    public RuntimeSkill {
        Objects.requireNonNull(skillId, "skillId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(sourceDshVersion, "sourceDshVersion");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(updatedAt, "updatedAt");
        skills = List.copyOf(Objects.requireNonNull(skills, "skills"));
    }

    public int skillCount() {
        return skills.size();
    }
}
