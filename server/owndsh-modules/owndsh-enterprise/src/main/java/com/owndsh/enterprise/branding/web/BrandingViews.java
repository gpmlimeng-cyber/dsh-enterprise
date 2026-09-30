/**
 * [INPUT]: 投影 BrandingService 的发布快照、资产与 revision 历史。
 * [OUTPUT]: 对外提供公开白名单视图与管理端视图两组严格 DTO，字符串化雪花 ID 且不含本地路径。
 * [POS]: branding/web 的唯一安全投影；公开视图只输出 URL/哈希/尺寸，管理端才输出资产 ID。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

import com.owndsh.enterprise.branding.application.BrandingService;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import com.owndsh.enterprise.branding.domain.BrandingLogoSlot;

import java.time.Instant;

public final class BrandingViews {
    private static final String PUBLIC_ASSET_PATH = "/enterprise/api/v1/branding/assets/";
    private static final String ADMIN_ASSET_PATH = "/enterprise/admin/v1/branding/assets/";

    private BrandingViews() {
    }

    public static PublicBranding publicBranding(BrandingService.PublishedBranding value) {
        BrandingDocument document = value.document();
        return new PublicBranding(
            value.revision(),
            document == null ? null : document.name(),
            document == null ? null : document.shortName(),
            new Logo(
                publicAsset(value, BrandingLogoSlot.LIGHT),
                publicAsset(value, BrandingLogoSlot.DARK),
                publicAsset(value, BrandingLogoSlot.SQUARE)
            ),
            new Welcome(
                document == null ? null : document.welcomeHeadline(),
                document == null ? null : document.welcomeEditionLabel()
            ),
            document == null ? null : document.publishedAt()
        );
    }

    public static AdminBranding adminBranding(BrandingService.PublishedBranding value) {
        BrandingDocument document = value.document();
        return new AdminBranding(
            value.revision(),
            document == null ? null : document.name(),
            document == null ? null : document.shortName(),
            new AdminLogo(
                adminAsset(value.assets().get(BrandingLogoSlot.LIGHT)),
                adminAsset(value.assets().get(BrandingLogoSlot.DARK)),
                adminAsset(value.assets().get(BrandingLogoSlot.SQUARE))
            ),
            new Welcome(
                document == null ? null : document.welcomeHeadline(),
                document == null ? null : document.welcomeEditionLabel()
            ),
            document == null ? null : document.publishedAt(),
            value.updatedBy() == null ? null : Long.toString(value.updatedBy())
        );
    }

    public static AdminBrandingAsset adminAsset(BrandingAsset asset) {
        if (asset == null) return null;
        return new AdminBrandingAsset(
            Long.toString(asset.id()), ADMIN_ASSET_PATH + asset.id() + "/content", asset.sha256(),
            asset.contentType(), asset.width(), asset.height(), asset.sizeBytes()
        );
    }

    public static AdminRevision adminRevision(BrandingDocument document, long currentRevision) {
        return new AdminRevision(
            Long.toString(document.id()), document.revision(), document.name(), document.shortName(),
            document.publishedAt(), document.revision() == currentRevision
        );
    }

    private static PublicAssetRef publicAsset(BrandingService.PublishedBranding value, BrandingLogoSlot slot) {
        BrandingAsset asset = value.assets().get(slot);
        if (asset == null) return null;
        return new PublicAssetRef(
            PUBLIC_ASSET_PATH + value.revision() + "/" + asset.sha256() + "." + asset.extension(),
            asset.sha256(), asset.contentType(), asset.width(), asset.height(), asset.sizeBytes()
        );
    }

    public record PublicBranding(
        long revision,
        String name,
        String shortName,
        Logo logo,
        Welcome welcome,
        Instant updatedAt
    ) {
    }

    public record PublicAssetRef(
        String url,
        String sha256,
        String contentType,
        int width,
        int height,
        long sizeBytes
    ) {
    }

    public record Logo(PublicAssetRef light, PublicAssetRef dark, PublicAssetRef square) {
    }

    public record Welcome(String headline, String editionLabel) {
    }

    public record AdminBranding(
        long revision,
        String name,
        String shortName,
        AdminLogo logo,
        Welcome welcome,
        Instant updatedAt,
        String updatedBy
    ) {
    }

    public record AdminLogo(
        AdminBrandingAsset light,
        AdminBrandingAsset dark,
        AdminBrandingAsset square
    ) {
    }

    public record AdminBrandingAsset(
        String id,
        String url,
        String sha256,
        String contentType,
        int width,
        int height,
        long sizeBytes
    ) {
    }

    public record AdminRevision(
        String id,
        long revision,
        String name,
        String shortName,
        Instant publishedAt,
        boolean current
    ) {
    }
}
