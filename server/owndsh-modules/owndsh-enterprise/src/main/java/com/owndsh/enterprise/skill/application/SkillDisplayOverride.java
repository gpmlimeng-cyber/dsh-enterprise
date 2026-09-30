/**
 * [INPUT]: 依赖管理端可选 displayName/description。
 * [OUTPUT]: 提供对 manifest 解析结果的显示字段覆盖边界。
 * [POS]: skill/application 的上传显示元数据，不改变 skillId/sourceDshVersion 真源。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

public record SkillDisplayOverride(String displayName, String description) {
}
