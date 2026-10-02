/**
 * [INPUT]: 依赖 manifest.json 顶层可选 dependencies 数组与服务端持久化的同一形状。
 * [OUTPUT]: 提供一条配方引用事实(kind/id/mode/versionId?/required)与其线格式字面量常量。
 * [POS]: preset/domain 的软引用值对象；不解析 Cordis 语义、不建跨包外键。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.util.Objects;

/**
 * 配方版本引用的一项技能或插件。
 *
 * <p>`versionId` 为雪花 ID 的十进制字符串（与契约 {@code PresetVersionId} 同一形状），
 * 只有 {@code mode=pinned} 才允许非空；{@code latest} 表示"跟该资产当前最新 PUBLISHED"。
 */
public record PresetDependency(
    String kind,
    String id,
    String mode,
    String versionId,
    boolean required
) {
    public static final String KIND_SKILL = "skill";
    public static final String KIND_PLUGIN = "plugin";
    public static final String MODE_PINNED = "pinned";
    public static final String MODE_LATEST = "latest";

    public PresetDependency {
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(mode, "mode");
    }
}
