/**
 * [INPUT]: 依赖 dsh-skill v1 包身份与状态封闭集合。
 * [OUTPUT]: 提供不可变的技能 package 事实。
 * [POS]: skill/domain 的目录根，revision 供可见范围与元数据 CAS。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.domain;

import java.util.Objects;

public record SkillPackage(
    long id,
    String tenantId,
    String skillId,
    String displayName,
    String description,
    Status status,
    long revision
) {
    public enum Status { ACTIVE, DISABLED }

    public SkillPackage {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(skillId, "skillId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(status, "status");
    }
}
