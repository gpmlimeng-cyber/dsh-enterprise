/**
 * [INPUT]: 依赖 V32 三表与 Spring JDBC。
 * [OUTPUT]: 实现品牌配置 CAS、发布文档 keyset 历史、资产注册与已发布引用解析。
 * [POS]: branding/persistence 的 PostgreSQL adapter；公开资源查询必须在同一语句内联结当前发布 revision。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.persistence;

import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingConfig;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class JdbcBrandingStore implements BrandingStore {
    private static final String DOCUMENT_COLUMNS = """
        d.id, d.tenant_id, d.config_id, d.revision, d.name, d.short_name,
        d.logo_light_asset_id, d.logo_dark_asset_id, d.logo_square_asset_id,
        d.welcome_headline, d.welcome_edition_label, d.published_by, d.published_at
        """;

    private static final RowMapper<BrandingConfig> CONFIG = (rs, rowNumber) -> new BrandingConfig(
        rs.getLong("id"), rs.getString("tenant_id"), (Long) rs.getObject("organization_id"),
        rs.getLong("revision"), (Long) rs.getObject("updated_by"),
        rs.getTimestamp("updated_at").toInstant()
    );

    private static final RowMapper<BrandingDocument> DOCUMENT = (rs, rowNumber) -> new BrandingDocument(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("config_id"), rs.getLong("revision"),
        rs.getString("name"), rs.getString("short_name"),
        (Long) rs.getObject("logo_light_asset_id"), (Long) rs.getObject("logo_dark_asset_id"),
        (Long) rs.getObject("logo_square_asset_id"),
        rs.getString("welcome_headline"), rs.getString("welcome_edition_label"),
        rs.getLong("published_by"), rs.getTimestamp("published_at").toInstant()
    );

    private static final RowMapper<BrandingAsset> ASSET = (rs, rowNumber) -> new BrandingAsset(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getString("artifact_ref"), rs.getString("sha256"),
        rs.getString("content_type"), rs.getLong("size_bytes"), rs.getInt("width"), rs.getInt("height"),
        rs.getLong("created_by"), rs.getTimestamp("created_at").toInstant()
    );

    private final JdbcTemplate jdbc;

    public JdbcBrandingStore(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<BrandingConfig> findConfig(String tenantId) {
        return one(jdbc.query(
            "select * from ent_branding_config where tenant_id = ? and organization_id is null",
            CONFIG, tenantId
        ));
    }

    @Override
    public Optional<BrandingConfig> findConfigForUpdate(String tenantId) {
        return one(jdbc.query(
            "select * from ent_branding_config where tenant_id = ? and organization_id is null for update",
            CONFIG, tenantId
        ));
    }

    @Override
    public boolean insertConfigIfAbsent(long id, String tenantId, Instant updatedAt) {
        return jdbc.update(
            """
            insert into ent_branding_config (id, tenant_id, organization_id, revision, updated_by, updated_at)
            values (?, ?, null, 0, null, ?)
            on conflict (tenant_id) where organization_id is null do nothing
            """,
            id, tenantId, Timestamp.from(updatedAt)
        ) == 1;
    }

    @Override
    public boolean compareAndSetRevision(
        String tenantId, long configId, long expectedRevision, long newRevision, long updatedBy, Instant updatedAt
    ) {
        return jdbc.update(
            """
            update ent_branding_config
            set revision = ?, updated_by = ?, updated_at = ?
            where tenant_id = ? and id = ? and revision = ?
            """,
            newRevision, updatedBy, Timestamp.from(updatedAt), tenantId, configId, expectedRevision
        ) == 1;
    }

    @Override
    public Optional<BrandingDocument> findCurrentDocument(String tenantId) {
        return one(jdbc.query(
            "select " + DOCUMENT_COLUMNS + """
             from ent_branding_config c
             join ent_branding_document d on d.config_id = c.id and d.revision = c.revision
             where c.tenant_id = ? and c.organization_id is null
            """,
            DOCUMENT, tenantId
        ));
    }

    @Override
    public Optional<BrandingDocument> findDocumentByRevision(String tenantId, long configId, long revision) {
        return one(jdbc.query(
            "select " + DOCUMENT_COLUMNS + """
             from ent_branding_document d
             join ent_branding_config c on c.id = d.config_id
             where c.tenant_id = ? and d.config_id = ? and d.revision = ?
            """,
            DOCUMENT, tenantId, configId, revision
        ));
    }

    @Override
    public void insertDocument(BrandingDocument document) {
        jdbc.update(
            """
            insert into ent_branding_document
            (id, tenant_id, config_id, revision, name, short_name, logo_light_asset_id, logo_dark_asset_id,
             logo_square_asset_id, welcome_headline, welcome_edition_label, published_by, published_at)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            document.id(), document.tenantId(), document.configId(), document.revision(), document.name(),
            document.shortName(), document.logoLightAssetId(), document.logoDarkAssetId(),
            document.logoSquareAssetId(), document.welcomeHeadline(), document.welcomeEditionLabel(),
            document.publishedBy(), Timestamp.from(document.publishedAt())
        );
    }

    @Override
    public List<BrandingDocument> listDocuments(String tenantId, long configId, long afterId, int limit) {
        return jdbc.query(
            "select " + DOCUMENT_COLUMNS + """
             from ent_branding_document d
             join ent_branding_config c on c.id = d.config_id
             where c.tenant_id = ? and d.config_id = ? and d.id < ?
             order by d.id desc limit ?
            """,
            DOCUMENT, tenantId, configId, afterId <= 0 ? Long.MAX_VALUE : afterId, limit
        );
    }

    @Override
    public Optional<BrandingAsset> findAsset(String tenantId, long assetId) {
        return one(jdbc.query(
            "select * from ent_branding_asset where tenant_id = ? and id = ?", ASSET, tenantId, assetId
        ));
    }

    @Override
    public Optional<BrandingAsset> findAssetByHash(String tenantId, String sha256) {
        return one(jdbc.query(
            "select * from ent_branding_asset where tenant_id = ? and sha256 = ?", ASSET, tenantId, sha256
        ));
    }

    @Override
    public void insertAsset(BrandingAsset asset) {
        jdbc.update(
            """
            insert into ent_branding_asset
            (id, tenant_id, artifact_ref, sha256, content_type, size_bytes, width, height, created_by, created_at)
            values (?,?,?,?,?,?,?,?,?,?)
            """,
            asset.id(), asset.tenantId(), asset.artifactRef(), asset.sha256(), asset.contentType(),
            asset.sizeBytes(), asset.width(), asset.height(), asset.createdBy(), Timestamp.from(asset.createdAt())
        );
    }

    @Override
    public Optional<BrandingAsset> findPublishedAssetByHash(String tenantId, long configRevision, String sha256) {
        return one(jdbc.query(
            """
            select a.* from ent_branding_config c
            join ent_branding_document d on d.config_id = c.id and d.revision = ?
            join ent_branding_asset a on a.id in (
                d.logo_light_asset_id, d.logo_dark_asset_id, d.logo_square_asset_id
            )
            where c.tenant_id = ? and c.organization_id is null and a.sha256 = ?
            """,
            ASSET, configRevision, tenantId, sha256
        ));
    }

    private static <T> Optional<T> one(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }
}
