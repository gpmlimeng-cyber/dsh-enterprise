/**
 * [INPUT]: 依赖 package 与 ALL/USER 可见范围封闭集合。
 * [OUTPUT]: 提供不可变的技能可见性 assignment。
 * [POS]: skill/domain 的可见范围事实，无 DEPT 与 required 字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.domain;

import java.util.Objects;

public record SkillAssignment(
    long id,
    String tenantId,
    long packageId,
    SubjectType subjectType,
    Long subjectId,
    Status status,
    long revision
) {
    public enum SubjectType { ALL, USER }
    public enum Status { ACTIVE, DISABLED }

    public SkillAssignment {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(subjectType, "subjectType");
        Objects.requireNonNull(status, "status");
        if (subjectType == SubjectType.ALL && subjectId != null) {
            throw new IllegalArgumentException("ALL 主体不能携带 subjectId");
        }
        if (subjectType == SubjectType.USER && (subjectId == null || subjectId <= 0)) {
            throw new IllegalArgumentException("USER 主体必须携带正 subjectId");
        }
    }
}
