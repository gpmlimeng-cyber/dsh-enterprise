/**
 * [INPUT]: 由 runtime 在目标版本未发布或不可见时抛出。
 * [OUTPUT]: 对外提供 ENT_PRESET_VISIBILITY_DENIED 与 ENT_PRESET_NOT_PUBLISHED。
 * [POS]: preset/application 的员工授权失败边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

public final class PresetAccessException extends RuntimeException {
    public static final String VISIBILITY_DENIED = "ENT_PRESET_VISIBILITY_DENIED";
    public static final String NOT_PUBLISHED = "ENT_PRESET_NOT_PUBLISHED";

    private final String errorCode;

    public PresetAccessException(String errorCode) {
        super(errorCode);
        this.errorCode = errorCode;
    }

    public String errorCode() {
        return errorCode;
    }
}
