/**
 * [INPUT]: 依赖单个 SKILL.md 的 frontmatter 解析结果。
 * [OUTPUT]: 提供不可变的技能条目元数据与调用策略投影，不含正文。
 * [POS]: skill/domain 的最小事实单元，包内多技能由 SkillVersion 聚合。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.domain;

import java.util.Objects;

public record SkillEntry(
    String name,
    String description,
    String whenToUse,
    boolean modelInvocable,
    boolean userInvocable
) {
    public SkillEntry {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(description, "description");
        if (name.isEmpty() || description.isEmpty()) throw new IllegalArgumentException("技能 name/description 不能为空");
    }
}
