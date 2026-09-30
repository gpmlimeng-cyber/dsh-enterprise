/**
 * [INPUT]: 由 skill catalog 查不到 package/version 时抛出。
 * [OUTPUT]: 对外提供稳定 ENT_RESOURCE_NOT_FOUND。
 * [POS]: skill/application 的管理资源缺失边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

public final class SkillResourceNotFoundException extends RuntimeException {
    public static final String ERROR_CODE = "ENT_RESOURCE_NOT_FOUND";
}
