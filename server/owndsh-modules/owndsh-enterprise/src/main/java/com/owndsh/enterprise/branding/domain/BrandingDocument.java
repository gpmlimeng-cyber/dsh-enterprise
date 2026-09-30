/**
 * [INPUT]: 依赖品牌配置、revision、槽位资产外键与一期白名单文本字段。
 * [OUTPUT]: 提供不可变的发布快照事实与空文档判定。
 * [POS]: branding/domain 的发布真源；每次发布/回滚插入新行，历史行永不修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.domain;

import java.time.Instant;
import java.util.Objects;

public record BrandingDocument(
    long id,
    String tenantId,
    long configId,
    long revision,
    String name,
    String shortName,
    Long logoLightAssetId,
    Long logoDarkAssetId,
    Long logoSquareAssetId,
    String welcomeHeadline,
    String welcomeEditionLabel,
    long publishedBy,
    Instant publishedAt
) {
    public static final int MAX_NAME_LENGTH = 120;
    public static final int MAX_SHORT_NAME_LENGTH = 60;
    public static final int MAX_HEADLINE_LENGTH = 200;
    public static final int MAX_EDITION_LABEL_LENGTH = 60;

    public BrandingDocument {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(publishedAt, "publishedAt");
        if (revision <= 0) throw new IllegalArgumentException("revision 必须为正数");
    }

    public Long assetId(BrandingLogoSlot slot) {
        return switch (slot) {
            case LIGHT -> logoLightAssetId;
            case DARK -> logoDarkAssetId;
            case SQUARE -> logoSquareAssetId;
        };
    }
}
