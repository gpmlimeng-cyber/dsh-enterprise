/**
 * [INPUT]: 接收 builtin/featured 两个必填布尔标记。
 * [OUTPUT]: 对外提供显式解析后的标记值；字段缺席立刻失败，而不是静默落 false。
 * [POS]: skill/web 的标记写入边界，只承载标记本身，不承载 assignments。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import java.util.Objects;

public record SkillMarksRequest(Boolean builtin, Boolean featured) {
    public SkillMarksRequest {
        Objects.requireNonNull(builtin, "builtin");
        Objects.requireNonNull(featured, "featured");
    }

    /** 紧凑构造器已判非空，这里安全拆箱交给 application 层。 */
    public boolean requireBuiltin() {
        return builtin;
    }

    public boolean requireFeatured() {
        return featured;
    }
}
