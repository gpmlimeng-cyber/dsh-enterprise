/**
 * [INPUT]: 接收最多 200 条 ALL/USER 可见范围写项。
 * [OUTPUT]: 对外提供防御性复制并转换为 PresetCatalogService.AssignmentSpec。
 * [POS]: preset/web 的可见范围原子 replacement 边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

import com.owndsh.enterprise.preset.application.PresetCatalogService;
import com.owndsh.enterprise.preset.domain.PresetAssignment;

import java.util.List;
import java.util.Objects;

public record PresetAssignmentBatchRequest(List<Item> assignments) {
    public PresetAssignmentBatchRequest {
        assignments = List.copyOf(Objects.requireNonNull(assignments, "assignments"));
        if (assignments.size() > 200) throw new IllegalArgumentException("assignments 不能超过 200 条");
    }

    public List<PresetCatalogService.AssignmentSpec> specs() {
        return assignments.stream().map(Item::spec).toList();
    }

    public record Item(PresetAssignment.SubjectType subjectType, String subjectId) {
        public Item {
            Objects.requireNonNull(subjectType, "subjectType");
        }

        PresetCatalogService.AssignmentSpec spec() {
            return new PresetCatalogService.AssignmentSpec(
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
