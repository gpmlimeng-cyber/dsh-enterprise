/**
 * [INPUT]: 依赖 V32 品牌三表事实。
 * [OUTPUT]: 对外提供单行配置 CAS、发布文档历史、资产注册与"已发布文档引用"查询端口。
 * [POS]: branding/persistence 的 DIP 边界，隐藏 PostgreSQL 与 organization_id 预留列细节。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.persistence;

import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingConfig;
import com.owndsh.enterprise.branding.domain.BrandingDocument;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 品牌持久化端口。
 */
public interface BrandingStore {
    Optional<BrandingConfig> findConfig(String tenantId);

    Optional<BrandingConfig> findConfigForUpdate(String tenantId);

    boolean insertConfigIfAbsent(long id, String tenantId, Instant updatedAt);

    boolean compareAndSetRevision(
        String tenantId, long configId, long expectedRevision, long newRevision, long updatedBy, Instant updatedAt
    );

    Optional<BrandingDocument> findCurrentDocument(String tenantId);

    Optional<BrandingDocument> findDocumentByRevision(String tenantId, long configId, long revision);

    void insertDocument(BrandingDocument document);

    List<BrandingDocument> listDocuments(String tenantId, long configId, long afterId, int limit);

    Optional<BrandingAsset> findAsset(String tenantId, long assetId);

    Optional<BrandingAsset> findAssetByHash(String tenantId, String sha256);

    void insertAsset(BrandingAsset asset);

    Optional<BrandingAsset> findPublishedAssetByHash(String tenantId, long configRevision, String sha256);
}
