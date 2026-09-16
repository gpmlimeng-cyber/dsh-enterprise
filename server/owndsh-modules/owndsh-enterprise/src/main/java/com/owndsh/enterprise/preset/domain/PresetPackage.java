/**
 * [INPUT]: 依赖 dsh-preset v1 包身份与版本状态封闭集合。
 * [OUTPUT]: 提供不可变的配方 package 事实。
 * [POS]: preset/domain 的目录根，revision 供可见范围与元数据 CAS。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.util.Objects;

public record PresetPackage(
    long id,
    String tenantId,
    String presetId,
    String displayName,
    String description,
    Status status,
    long revision
) {
    public enum Status { ACTIVE, DISABLED }

    public PresetPackage {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(presetId, "presetId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(status, "status");
    }
}
