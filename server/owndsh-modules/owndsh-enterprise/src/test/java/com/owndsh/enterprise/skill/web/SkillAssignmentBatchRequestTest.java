/**
 * [INPUT]: 依赖 SkillAssignmentBatchRequest 与其 Item 的纯校验（无 DB、无 Spring 上下文）。
 * [OUTPUT]: 锁定批量分配的入参门禁：列表非空引用、200 条上限、subjectType 必填、subjectId 解析规则。
 * [POS]: skill/web 的分配入参门禁；分配会把技能推向全员，入参错一次就是影响面事故，故必须独立测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.owndsh.enterprise.skill.domain.SkillAssignment.SubjectType;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("dev")
class SkillAssignmentBatchRequestTest {

    private static List<SkillAssignmentBatchRequest.Item> items(int count) {
        List<SkillAssignmentBatchRequest.Item> list = new ArrayList<>();
        for (int i = 0; i < count; i++) list.add(new SkillAssignmentBatchRequest.Item(SubjectType.ALL, null));
        return list;
    }

    /** 列表引用不可为空：空指针必须立刻暴露，而不是等到遍历时。 */
    @Test
    void rejectsNullAssignmentList() {
        assertThrows(NullPointerException.class, () -> new SkillAssignmentBatchRequest(null));
    }

    /** 一次最多 200 条：正好 200 允许，201 必须拒绝。 */
    @Test
    void enforcesTwoHundredItemCeiling() {
        assertDoesNotThrow(() -> new SkillAssignmentBatchRequest(items(200)));
        assertThrows(IllegalArgumentException.class, () -> new SkillAssignmentBatchRequest(items(201)));
    }

    /** subjectType 是必填项。 */
    @Test
    void rejectsItemWithoutSubjectType() {
        assertThrows(NullPointerException.class, () -> new SkillAssignmentBatchRequest.Item(null, null));
    }

    /** ALL 主体不带 subjectId，且解析不得抛错。 */
    @Test
    void acceptsWholeTenantAssignment() {
        SkillAssignmentBatchRequest.Item item = new SkillAssignmentBatchRequest.Item(SubjectType.ALL, null);
        assertDoesNotThrow(item::spec);
    }

    /** USER 主体必须带正数 subjectId；0、负数与非数字一律拒绝。 */
    @Test
    void rejectsInvalidUserSubjectId() {
        assertThrows(IllegalArgumentException.class,
            () -> new SkillAssignmentBatchRequest.Item(SubjectType.USER, "0").spec());
        assertThrows(IllegalArgumentException.class,
            () -> new SkillAssignmentBatchRequest.Item(SubjectType.USER, "-5").spec());
        assertThrows(IllegalArgumentException.class,
            () -> new SkillAssignmentBatchRequest.Item(SubjectType.USER, "abc").spec());
        assertThrows(IllegalArgumentException.class,
            () -> new SkillAssignmentBatchRequest.Item(SubjectType.USER, "").spec());
    }

    /** USER 主体带合法正数则通过。 */
    @Test
    void acceptsPositiveUserSubjectId() {
        assertDoesNotThrow(() -> new SkillAssignmentBatchRequest.Item(SubjectType.USER, "2099887363275161601").spec());
    }
}
