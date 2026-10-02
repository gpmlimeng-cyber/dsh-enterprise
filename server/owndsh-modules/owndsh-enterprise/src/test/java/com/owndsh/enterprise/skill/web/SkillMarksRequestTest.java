/**
 * [INPUT]: 依赖 SkillMarksRequest 与其两个标记字段的纯校验（无 DB、无 Spring 上下文）。
 * [OUTPUT]: 锁定标记写入的入参门禁：builtin/featured 必填，缺席或 null 必须立刻失败。
 * [POS]: skill/web 的标记入参门禁；静默落 false 会把"要不要默认对员工可见"变成无痕误操作。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("dev")
class SkillMarksRequestTest {

    /** builtin 是必填项：缺席（null）必须立刻暴露，而不是静默当成 false。 */
    @Test
    void rejectsMissingBuiltinMark() {
        assertThrows(NullPointerException.class, () -> new SkillMarksRequest(null, false));
        assertThrows(NullPointerException.class, () -> new SkillMarksRequest(null, true));
        assertThrows(NullPointerException.class, () -> new SkillMarksRequest(null, null));
    }

    /** featured 同样是必填项。 */
    @Test
    void rejectsMissingFeaturedMark() {
        assertThrows(NullPointerException.class, () -> new SkillMarksRequest(false, null));
        assertThrows(NullPointerException.class, () -> new SkillMarksRequest(true, null));
    }

    /** 两个标记互相独立：一个置位不得改写另一个。 */
    @Test
    void exposesBothMarksIndependently() {
        SkillMarksRequest builtinOnly = new SkillMarksRequest(true, false);
        assertTrue(builtinOnly.requireBuiltin());
        assertFalse(builtinOnly.requireFeatured());

        SkillMarksRequest featuredOnly = new SkillMarksRequest(false, true);
        assertFalse(featuredOnly.requireBuiltin());
        assertTrue(featuredOnly.requireFeatured());
    }

    /** 两个标记同时落位也必须被原样保留。 */
    @Test
    void acceptsBothMarksTogether() {
        SkillMarksRequest both = new SkillMarksRequest(true, true);
        assertTrue(both.requireBuiltin());
        assertTrue(both.requireFeatured());
    }
}
