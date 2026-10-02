/**
 * [INPUT]: 聚合 tenant 内 npm package 名、显示名、**可选 description**、可分配状态与 CAS revision。
 * [OUTPUT]: 对外提供满足 package 命名和 revision 不变量的不可变插件聚合根。
 * [POS]: plugin/domain 的 assignment ownership 根，version 与 assignment 必须归属其 ID。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.domain;

import java.util.Objects;
import java.util.regex.Pattern;

public record PluginPackage(
    long id,
    String tenantId,
    String packageName,
    String displayName,
    /**
     * 制品 {@code package.json} 的 {@code description}：与 {@code displayName} **同源、同一条读取路径**
     * （{@code PluginArtifactInspector} 读 package.json），在**首个上传**时随 package 一起写入，之后不随新版本变化。
     * **可空**：没有描述就是 null——它是展示事实（员工端卡片第二行），不参与 package 的合法性判定。
     */
    String description,
    Status status,
    long revision
) {
    private static final Pattern PACKAGE_NAME = Pattern.compile(
        "^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$"
    );
    /** 与契约 `PluginDescription.maxLength`、验包器 `MAX_DESCRIPTION_LENGTH` 同值。 */
    private static final int MAX_DESCRIPTION_LENGTH = 1000;

    public PluginPackage {
        if (id <= 0) throw new IllegalArgumentException("package ID 必须为正数");
        tenantId = requireText(tenantId, "tenantId", 20);
        packageName = requireText(packageName, "packageName", 214);
        if (!PACKAGE_NAME.matcher(packageName).matches()) throw new IllegalArgumentException("packageName 非法");
        displayName = requireText(displayName, "displayName", 120);
        // 描述可空；非空则必须是 ≤1000 的非空白文本（验包器是唯一写入口，这里是聚合根的第二道闸）。
        if (description != null && (description.isBlank() || description.length() > MAX_DESCRIPTION_LENGTH)) {
            throw new IllegalArgumentException("description 非法");
        }
        Objects.requireNonNull(status, "status");
        if (revision < 0) throw new IllegalArgumentException("revision 不能为负数");
    }

    private static String requireText(String value, String name, int maxLength) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > maxLength) throw new IllegalArgumentException(name + " 非法");
        return value;
    }

    public enum Status { ACTIVE, DISABLED }
}
