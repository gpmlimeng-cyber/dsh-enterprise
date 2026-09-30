/**
 * [INPUT]: 由 runtime 在目标版本未发布或不可见时抛出。
 * [OUTPUT]: 对外提供 ENT_SKILL_VISIBILITY_DENIED 与 ENT_SKILL_NOT_PUBLISHED。
 * [POS]: skill/application 的员工授权失败边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

public final class SkillAccessException extends RuntimeException {
    public static final String VISIBILITY_DENIED = "ENT_SKILL_VISIBILITY_DENIED";
    public static final String NOT_PUBLISHED = "ENT_SKILL_NOT_PUBLISHED";

    private final String errorCode;

    public SkillAccessException(String errorCode) {
        super(errorCode);
        this.errorCode = errorCode;
    }

    public String errorCode() {
        return errorCode;
    }
}
