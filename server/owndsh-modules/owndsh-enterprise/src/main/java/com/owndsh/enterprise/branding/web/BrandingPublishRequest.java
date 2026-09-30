/**
 * [INPUT]: 接收管理端发布的品牌白名单文本字段与可选槽位资产 ID（字符串雪花）。
 * [OUTPUT]: 对外提供转换为 BrandingService.BrandingDraft 的严格请求 DTO。
 * [POS]: branding/web 的发布请求边界，不接受 organization、revision、路径或任意扩展字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

import com.owndsh.enterprise.branding.application.BrandingService;

public record BrandingPublishRequest(
    String name,
    String shortName,
    String logoLightAssetId,
    String logoDarkAssetId,
    String logoSquareAssetId,
    String welcomeHeadline,
    String welcomeEditionLabel
) {
    public BrandingService.BrandingDraft draft() {
        return new BrandingService.BrandingDraft(
            name, shortName,
            parseId(logoLightAssetId, "logo.light"),
            parseId(logoDarkAssetId, "logo.dark"),
            parseId(logoSquareAssetId, "logo.square"),
            welcomeHeadline, welcomeEditionLabel
        );
    }

    private static Long parseId(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            long parsed = Long.parseLong(value.strip());
            if (parsed <= 0) throw new NumberFormatException();
            return parsed;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(name + " 资产 ID 非法", exception);
        }
    }
}
