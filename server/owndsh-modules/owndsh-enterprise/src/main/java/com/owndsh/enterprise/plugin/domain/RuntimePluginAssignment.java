/**
 * [INPUT]: 投影当前用户唯一生效 assignment、签名制品元数据、package 级**必填显示名**与**可选描述**、版本级**可选 README**。
 * [OUTPUT]: 以空字节数组表示未签名； 对外提供客户端双重校验、下载、安装调和与卡片标题/描述/README 展示所需的完整不可变事实。
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
     * 该 package 的 {@code displayName}（**必填、非空**）：员工端卡片**标题**的取值。
     * 它来自 package 那一行而不是版本那一行（displayName 是 **package 级**事实，随首个上传写入、
     * 不随版本变化）。与可空的 {@code description} 不同，这里**永远拿得出非空名字**：
     * 制品包里没写/写了空白/非字符串时，验包器（{@code PluginArtifactInspector}）已回退成包名，
     * 故本 record 只做「非空白且 ≤120」的第二道闸——契约 {@code PluginDisplayName} 是必填属性。
     */
    String displayName,
    /**
     * 该 package 的 {@code description}（可空）。它来自 package 那一行而不是版本那一行：
     * description 是 **package 级**事实（与 displayName 同源），随首个上传写入、不随版本变化。
     * **可空**：没有描述就是 null，投影层据此**整个键不下发**（契约里 `PluginDescription` 是可选属性）。
     */
    String description,
    /**
     * 该**版本**制品里那份 README 的纯文本（可空，契约 `PluginReadme` ≤65536）。
     *
     * <p>与上面那枚 `description` 的层级有意不同：description 是 **package 级**事实，而 README 是
     * **版本级**事实（它躺在这一版的 tar 里）——故这里取的是 assignment 指向的**那一版**的 README，
     * 换版本时它跟着换。员工端插件详情「描述」段的**首选**取值就是它，没有才回落到 description。
     *
     * <p>**可空**：这一版没有解出 README（旧数据、非 UTF-8、空白）时是 null，投影层据此**整个键不下发**
     * （契约里 `PluginReadme` 是可选属性），绝不发空串或 null 占位。
     */
    String readme,
    long sizeBytes,
    String sha256,
    byte[] signature,
    PluginCompatibility compatibility,
    boolean required,
    PluginAssignment.DesiredState desiredState
) {
    /** 与契约 `PluginDisplayName.maxLength` 同值（`PluginPackage` 的同一道闸也是 120）。 */
    private static final int MAX_DISPLAY_NAME_LENGTH = 120;
    /** 与契约 `PluginDescription.maxLength`、`PluginPackage.MAX_DESCRIPTION_LENGTH` 同值。 */
    private static final int MAX_DESCRIPTION_LENGTH = 1000;
    /** 与契约 `PluginReadme.maxLength`、`PluginVersion.MAX_README_LENGTH` 同值（字符数上界）。 */
    private static final int MAX_README_LENGTH = 65_536;

    public RuntimePluginAssignment {
        if (pluginVersionId <= 0 || sizeBytes <= 0) throw new IllegalArgumentException("版本 ID/大小必须为正数");
        Objects.requireNonNull(packageName, "packageName");
        Objects.requireNonNull(version, "version");
        // 显示名必填：空白或超长一律判非法（验包器是唯一写入口，这里是聚合边界的第二道闸）。
        if (displayName == null || displayName.isBlank() || displayName.length() > MAX_DISPLAY_NAME_LENGTH) {
            throw new IllegalArgumentException("displayName 非法");
        }
        // 描述可空；非空则必须是 ≤1000 的非空白文本（越界/空白一律判非法，免得产出违契约的线协议）。
        if (description != null && (description.isBlank() || description.length() > MAX_DESCRIPTION_LENGTH)) {
            throw new IllegalArgumentException("description 非法");
        }
        // README 可空；非空则必须是 ≤65536 的非空白文本（越界/空白一律判非法，免得产出违契约的线协议）。
        if (readme != null && (readme.isBlank() || readme.length() > MAX_README_LENGTH)) {
            throw new IllegalArgumentException("readme 非法");
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
