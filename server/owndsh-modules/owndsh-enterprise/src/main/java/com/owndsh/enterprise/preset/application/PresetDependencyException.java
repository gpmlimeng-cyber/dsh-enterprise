/**
 * [INPUT]: 由发布口的依赖形状复检与必填引用解析失败时抛出。
 * [OUTPUT]: 对外提供 ENT_PRESET_DEPENDENCIES_INVALID / ENT_PRESET_DEPENDENCY_KIND_UNSUPPORTED /
 *           ENT_PRESET_REQUIRES_MISSING / ENT_PRESET_REQUIRES_NOT_PUBLISHED 四个稳定错误码。
 * [POS]: preset/application 的发布口 fail-closed 边界（漏一个 required 会在员工端才炸，必须在这里拦）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

import java.util.Objects;

public final class PresetDependencyException extends RuntimeException {
    /** 发布时发现 dependencies 形状非法（含重复引用、超上限、pinned/latest 坐标不自洽）。 */
    public static final String DEPENDENCIES_INVALID = "ENT_PRESET_DEPENDENCIES_INVALID";
    /** 发布时发现引用类型不在 skill/plugin 内。 */
    public static final String DEPENDENCY_KIND_UNSUPPORTED = "ENT_PRESET_DEPENDENCY_KIND_UNSUPPORTED";
    /** required 引用在中心不存在（技能 skillId / 插件 npm 名 / pinned versionId 均查不到）。 */
    public static final String REQUIRES_MISSING = "ENT_PRESET_REQUIRES_MISSING";
    /** required 引用存在，但当前没有可分发版本（未 PUBLISHED / 已 RETIRED，或 package 非 ACTIVE）。 */
    public static final String REQUIRES_NOT_PUBLISHED = "ENT_PRESET_REQUIRES_NOT_PUBLISHED";

    private final String errorCode;

    /**
     * @param errorCode 上述四个常量之一
     * @param message   面向管理员的失败说明；只允许包含已过形状校验的字面量（kind/id）
     */
    public PresetDependencyException(String errorCode, String message) {
        super(Objects.requireNonNull(message, "message"));
        this.errorCode = Objects.requireNonNull(errorCode, "errorCode");
    }

    public String errorCode() {
        return errorCode;
    }
}
