/**
 * [INPUT]: 由验包与制品写入失败时抛出。
 * [OUTPUT]: 对外提供 ENT_SKILL_INVALID_PACKAGE 与 ENT_SKILL_TOO_LARGE 稳定错误码。
 * [POS]: skill/artifact 的不可信包失败边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.artifact;

public final class SkillArtifactException extends RuntimeException {
    public enum Kind { INVALID, TOO_LARGE }

    private final Kind kind;

    public SkillArtifactException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public SkillArtifactException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }

    public String errorCode() {
        return kind == Kind.TOO_LARGE ? "ENT_SKILL_TOO_LARGE" : "ENT_SKILL_INVALID_PACKAGE";
    }
}
