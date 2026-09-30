/**
 * [INPUT]: 依赖 tenant、CAS artifactRef 与已校验的位图元数据。
 * [OUTPUT]: 提供不可变的品牌位图资产事实，不暴露本地路径。
 * [POS]: branding/domain 的资产真源，被发布文档按槽位引用且只增不删。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.domain;

import java.time.Instant;
import java.util.Objects;

public record BrandingAsset(
    long id,
    String tenantId,
    String artifactRef,
    String sha256,
    String contentType,
    long sizeBytes,
    int width,
    int height,
    long createdBy,
    Instant createdAt
) {
    public BrandingAsset {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(artifactRef, "artifactRef");
        Objects.requireNonNull(sha256, "sha256");
        Objects.requireNonNull(contentType, "contentType");
        Objects.requireNonNull(createdAt, "createdAt");
        if (sizeBytes <= 0) throw new IllegalArgumentException("sizeBytes 必须为正数");
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("图片尺寸必须为正数");
    }

    /**
     * 内容类型到公开 URL 扩展名的唯一映射；扩展名不是独立事实，避免与 contentType 漂移。
     */
    public String extension() {
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/jpeg" -> "jpg";
            case "image/webp" -> "webp";
            default -> throw new IllegalStateException("品牌资产内容类型越界");
        };
    }
}
