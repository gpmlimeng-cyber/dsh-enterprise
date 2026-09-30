/**
 * [INPUT]: 依赖 BrandingViews 投影、Jackson 3 JsonMapper 与手工构造的发布快照。
 * [OUTPUT]: 锁定公开视图只含白名单字段（无资产 ID/组织/本地路径），管理端视图才输出 ID 与预览 URL。
 * [POS]: branding/web 的公开泄露面门禁，用 JSON 序列化结果而不是字段名清单自证边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

import com.owndsh.enterprise.branding.application.BrandingService;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import com.owndsh.enterprise.branding.domain.BrandingLogoSlot;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class BrandingViewsTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final BrandingAsset asset = new BrandingAsset(
        1900900000000000001L, "000000", "sha256:" + "a".repeat(64), "a".repeat(64),
        "image/png", 20480, 512, 512, 7, Instant.parse("2026-09-30T03:00:00Z")
    );
    private final BrandingDocument document = new BrandingDocument(
        1900900000000000011L, "000000", 1900900000000000002L, 4,
        "DeepSeek Harness 企业版", "DSH 企业版", asset.id(), null, null,
        "探索未至之境", "预览版", 7, Instant.parse("2026-09-30T03:00:00Z")
    );

    @Test
    void publicProjectionCarriesOnlyWhiteListedFieldsAndImmutableUrl() {
        String json = JSON.writeValueAsString(BrandingViews.publicBranding(published()));

        assertThat(json)
            .contains("/enterprise/api/v1/branding/assets/4/" + "a".repeat(64) + ".png")
            .contains("探索未至之境")
            .contains("预览版")
            .doesNotContain("artifactRef")
            .doesNotContain("sha256:")
            .doesNotContain("organizationId")
            .doesNotContain("updatedBy")
            .doesNotContain("\"id\"")
            .doesNotContain("1900900000000000001")
            .doesNotContain("/data/");
    }

    @Test
    void adminProjectionExposesAssetIdAndAdminPreviewPathOnly() {
        String json = JSON.writeValueAsString(BrandingViews.adminBranding(published()));

        assertThat(json)
            .contains("\"id\":\"1900900000000000001\"")
            .contains("/enterprise/admin/v1/branding/assets/1900900000000000001/content")
            .contains("\"updatedBy\":\"7\"")
            .doesNotContain("artifactRef")
            .doesNotContain("/data/");
    }

    private BrandingService.PublishedBranding published() {
        return new BrandingService.PublishedBranding(
            4, document, 7L, Map.of(BrandingLogoSlot.LIGHT, asset)
        );
    }
}
