/**
 * [INPUT]: 聚合 package、tgz CAS 引用、整包 hash、Ed25519 签名、compatibility、版本状态与**可选 README 纯文本**。
 * [OUTPUT]: 以空字节数组表示未签名； 对外提供防御性复制签名并约束 UPLOADED/VALIDATED/PUBLISHED/RETIRED 事实的不可变版本。
 * [POS]: plugin/domain 的可下载制品身份，artifactId 固定等于字符串化 version ID。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.regex.Pattern;

public record PluginVersion(
    long id,
    String tenantId,
    long packageId,
    String packageName,
    String version,
    String artifactRef,
    /**
     * 这一版制品 tar 里那份 README 的纯文本（**可空**，契约 `PluginReadme` ≤65536）。
     *
     * <p>它是**版本级**事实（README 就躺在这一版的 tar 里，验包器 {@code PluginArtifactInspector}
     * 从归档解出来）：同一个包发 v2 时 README 很可能改了，故不能像 {@code description} 那样
     * 「随首个上传写入、之后不覆盖」——那会让员工端永远看到第一版的 README。
     *
     * <p>可空：没有 / 非 UTF-8 / 空白都是 null（验包器归一），员工端据此如实回落到短 `description`。
     * 存量行由 `PluginReadmeBackfill` 按已存制品回填；回填不到就保持 null，绝不填空串。
     */
    String readme,
    long sizeBytes,
    String sha256,
    byte[] signature,
    PluginCompatibility compatibility,
    Status status,
    long createdBy,
    Instant createdAt,
    long revision
) {
    private static final Pattern SEMVER = Pattern.compile(
        "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$"
    );
    /** 与契约 `PluginReadme.maxLength`、验包器 `MAX_README_BYTES` 同一批口径的字符数上界。 */
    private static final int MAX_README_LENGTH = 65_536;

    public PluginVersion {
        if (id <= 0 || packageId <= 0 || createdBy <= 0) throw new IllegalArgumentException("插件 ID 必须为正数");
        requireText(tenantId, "tenantId");
        requireText(packageName, "packageName");
        requireText(artifactRef, "artifactRef");
        if (version == null || version.length() > 64 || !SEMVER.matcher(version).matches()) {
            throw new IllegalArgumentException("version 非法");
        }
        if (sizeBytes <= 0 || sha256 == null || !sha256.matches("^[0-9a-f]{64}$")) {
            throw new IllegalArgumentException("制品大小或 SHA-256 非法");
        }
        // README 可空；非空则必须是 ≤65536 的非空白文本（验包器是唯一写入口，这里是聚合根的第二道闸）。
        // 上界与契约 `PluginReadme.maxLength`、验包器的 UTF-8 字节闸同值：字符数不可能超过字节数。
        if (readme != null && (readme.isBlank() || readme.length() > MAX_README_LENGTH)) {
            throw new IllegalArgumentException("readme 非法");
        }
        if (signature == null || (signature.length != 0 && signature.length != 64)) throw new IllegalArgumentException("未签名必须为空字节数组，Ed25519 签名必须为 64 字节");
        signature = signature.clone();
        Objects.requireNonNull(compatibility, "compatibility");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        if (revision < 0) throw new IllegalArgumentException("revision 不能为负数");
    }

    @Override
    public byte[] signature() {
        return signature.clone();
    }

    private static void requireText(String value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isBlank()) throw new IllegalArgumentException(name + " 不能为空");
    }

    public enum Status { UPLOADED, VALIDATED, PUBLISHED, RETIRED }
}
