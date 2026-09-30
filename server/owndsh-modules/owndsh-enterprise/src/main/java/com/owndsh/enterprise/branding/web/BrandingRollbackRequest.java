/**
 * [INPUT]: 接收管理端指定的历史 revision（字符串雪花无关的正整数）。
 * [OUTPUT]: 对外提供校验后的目标 revision。
 * [POS]: branding/web 的回滚请求边界，只允许引用已存在的更早 revision。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

public record BrandingRollbackRequest(String targetRevision) {
    public long requireTargetRevision() {
        if (targetRevision == null || targetRevision.isBlank()) {
            throw new IllegalArgumentException("targetRevision 必填");
        }
        try {
            long parsed = Long.parseLong(targetRevision.strip());
            if (parsed <= 0) throw new NumberFormatException();
            return parsed;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("targetRevision 非法", exception);
        }
    }
}
