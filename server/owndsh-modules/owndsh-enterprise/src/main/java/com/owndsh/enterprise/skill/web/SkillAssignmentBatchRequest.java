/**
 * [INPUT]: 接收最多 200 条 ALL/USER 可见范围写项。
 * [OUTPUT]: 对外提供防御性复制并转换为 SkillCatalogService.AssignmentSpec。
 * [POS]: skill/web 的可见范围原子 replacement 边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import com.owndsh.enterprise.skill.application.SkillCatalogService;
import com.owndsh.enterprise.skill.domain.SkillAssignment;

import java.util.List;
import java.util.Objects;

public record SkillAssignmentBatchRequest(List<Item> assignments) {
    public SkillAssignmentBatchRequest {
        assignments = List.copyOf(Objects.requireNonNull(assignments, "assignments"));
        if (assignments.size() > 200) throw new IllegalArgumentException("assignments 不能超过 200 条");
    }

    public List<SkillCatalogService.AssignmentSpec> specs() {
        return assignments.stream().map(Item::spec).toList();
    }

    public record Item(SkillAssignment.SubjectType subjectType, String subjectId) {
        public Item {
            Objects.requireNonNull(subjectType, "subjectType");
        }

        SkillCatalogService.AssignmentSpec spec() {
            return new SkillCatalogService.AssignmentSpec(
                subjectType, subjectId == null ? null : parseId(subjectId, "subjectId")
            );
        }

        private static long parseId(String value, String name) {
            try {
                long parsed = Long.parseLong(value);
                if (parsed <= 0) throw new NumberFormatException();
                return parsed;
            } catch (RuntimeException exception) {
                throw new IllegalArgumentException(name + " 非法", exception);
            }
        }
    }
}
