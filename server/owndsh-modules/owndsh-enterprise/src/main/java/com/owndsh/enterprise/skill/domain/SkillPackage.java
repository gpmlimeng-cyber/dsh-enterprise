/**
 * [INPUT]: 依赖 dsh-skill v1 包身份与状态封闭集合。
 * [OUTPUT]: 提供不可变的技能 package 事实，含 builtin（默认对员工可见）、featured（仅标记，未来推荐区消费）与 category（可选分类，null 表示没有分类）。
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
    String category,
    boolean builtin,
    boolean featured,
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
