/**
 * [INPUT]: 投影当前用户唯一生效 assignment、签名制品元数据与 package 级**可选描述**。
 * [OUTPUT]: 以空字节数组表示未签名； 对外提供客户端双重校验、下载、安装调和与卡片展示所需的完整不可变事实。
 * [POS]: plugin/domain 的 runtime 安全投影，不暴露 artifact 文件路径或管理主体。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.domain;

import java.util.Objects;

public record RuntimePluginAssignment(
    long pluginVersionId,
    String packageName,
    String version,
    /**
     * 该 package 的 {@code description}（可空）。它来自 package 那一行而不是版本那一行：
     * description 是 **package 级**事实（与 displayName 同源），随首个上传写入、不随版本变化。
     * **可空**：没有描述就是 null，投影层据此**整个键不下发**（契约里 `PluginDescription` 是可选属性）。
     */
    String description,
    long sizeBytes,
    String sha256,
    byte[] signature,
    PluginCompatibility compatibility,
    boolean required,
    PluginAssignment.DesiredState desiredState
) {
    /** 与契约 `PluginDescription.maxLength`、`PluginPackage.MAX_DESCRIPTION_LENGTH` 同值。 */
    private static final int MAX_DESCRIPTION_LENGTH = 300;

    public RuntimePluginAssignment {
        if (pluginVersionId <= 0 || sizeBytes <= 0) throw new IllegalArgumentException("版本 ID/大小必须为正数");
        Objects.requireNonNull(packageName, "packageName");
        Objects.requireNonNull(version, "version");
        // 描述可空；非空则必须是 ≤300 的非空白文本（越界/空白一律判非法，免得产出违契约的线协议）。
        if (description != null && (description.isBlank() || description.length() > MAX_DESCRIPTION_LENGTH)) {
            throw new IllegalArgumentException("description 非法");
        }
        if (sha256 == null || !sha256.matches("^[0-9a-f]{64}$")) throw new IllegalArgumentException("SHA-256 非法");
        if (signature == null || (signature.length != 0 && signature.length != 64)) throw new IllegalArgumentException("未签名必须为空字节数组，Ed25519 签名必须为 64 字节");
        signature = signature.clone();
        Objects.requireNonNull(compatibility, "compatibility");
        Objects.requireNonNull(desiredState, "desiredState");
    }

    @Override
    public byte[] signature() {
        return signature.clone();
    }
}
