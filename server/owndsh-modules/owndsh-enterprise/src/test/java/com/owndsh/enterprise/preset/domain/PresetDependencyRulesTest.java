/**
 * [INPUT]: 依赖 PresetDependency 值对象与 PresetDependencyRules 纯规则。
 * [OUTPUT]: 锁定引用形状闸的每一档：类型不支持、pinned/latest 坐标不自洽、id 语法、查重与条数上限。
 * [POS]: preset/domain 的单元验收，不依赖 PostgreSQL 与 Spring。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class PresetDependencyRulesTest {

    @Test
    void acceptsPinnedAndLatestReferences() {
        assertTrue(PresetDependencyRules.inspect(List.of(
            dependency("skill", "expense-reimbursement", "pinned", "1901500000000000902", true),
            dependency("plugin", "@deepseek-ai/dsh-agent-preset", "latest", null, false)
        )).isEmpty());
    }

    @Test
    void acceptsEmptyDependencyList() {
        assertTrue(PresetDependencyRules.inspect(List.of()).isEmpty());
    }

    @Test
    void reportsUnsupportedKind() {
        assertEquals(
            PresetDependencyRules.Violation.KIND_UNSUPPORTED,
            findingOf(List.of(dependency("connector", "expense-reimbursement", "latest", null, true))).violation()
        );
    }

    @Test
    void rejectsPinnedReferenceWithoutVersionId() {
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(List.of(dependency("skill", "expense-reimbursement", "pinned", null, true))).violation()
        );
    }

    @Test
    void rejectsLatestReferenceCarryingVersionId() {
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(List.of(
                dependency("skill", "expense-reimbursement", "latest", "1901500000000000902", false)
            )).violation()
        );
    }

    @Test
    void rejectsSkillIdOutsideTheCatalogSyntax() {
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(List.of(dependency("skill", "Expense Reimbursement", "latest", null, true))).violation()
        );
    }

    @Test
    void rejectsPluginNameOutsideNpmSyntax() {
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(List.of(dependency("plugin", "DeepSeek/Agent", "latest", null, true))).violation()
        );
    }

    @Test
    void rejectsDuplicateKindAndId() {
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(List.of(
                dependency("skill", "expense-reimbursement", "latest", null, false),
                dependency("skill", "expense-reimbursement", "pinned", "1901500000000000902", true)
            )).violation()
        );
    }

    @Test
    void rejectsMoreDependenciesThanTheLimit() {
        List<PresetDependency> dependencies = new ArrayList<>();
        for (int index = 0; index <= PresetDependencyRules.MAX_DEPENDENCIES; index++) {
            dependencies.add(dependency("skill", "skill-" + index, "latest", null, false));
        }
        assertEquals(
            PresetDependencyRules.Violation.SHAPE_INVALID,
            findingOf(dependencies).violation()
        );
    }

    @Test
    void labelsOnlyValidatedKindAndId() {
        assertEquals(
            "skill/expense-reimbursement",
            PresetDependencyRules.label(dependency("skill", "expense-reimbursement", "pinned", "1901", true))
        );
    }

    private static PresetDependency dependency(
        String kind, String id, String mode, String versionId, boolean required
    ) {
        return new PresetDependency(kind, id, mode, versionId, required);
    }

    private static PresetDependencyRules.Finding findingOf(List<PresetDependency> dependencies) {
        return PresetDependencyRules.inspect(dependencies).orElseThrow();
    }
}
