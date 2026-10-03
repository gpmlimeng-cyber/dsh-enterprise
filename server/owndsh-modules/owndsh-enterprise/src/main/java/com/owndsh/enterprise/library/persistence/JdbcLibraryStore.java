/**
 * [INPUT]: 依赖 Spring `JdbcOperations`、Jackson 3 的 JsonMapper（conversion_warnings 的 jsonb 编解码）与 V43 的五张资料库表。
 * [OUTPUT]: 资料库服务端权威存储的 PostgreSQL adapter：节点/资产/修订/草稿/引用的插入与按主体查询、`nextRevisionNumber`、草稿正文的 CAS 更新、资产"当前修订"指针的 CAS 移动、级联删除所需的按资产清理。
 * [POS]: library/persistence 的唯一 adapter。三条纪律：① 每条查询都带 `tenant_id` 与 `owner_id`（跨主体读回 null，与 bundle 侧"跨主体一律 not-found"同语义）；② 修订**只有 insert**，本类不存在任何 `update ent_library_revision`（不可覆盖的源码级表达）；③ 指针与 token 的移动一律走 CAS（受影响 0 行 = 乐观锁冲突，调用方据此抛 `library/revision-conflict` / `library/base-revision-conflict`）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.persistence;

import com.owndsh.enterprise.library.domain.LibraryAsset;
import com.owndsh.enterprise.library.domain.LibraryDraft;
import com.owndsh.enterprise.library.domain.LibraryNode;
import com.owndsh.enterprise.library.domain.LibraryReference;
import com.owndsh.enterprise.library.domain.LibraryRevision;
import com.owndsh.enterprise.library.domain.LibraryScope;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 资料库五张表的 JDBC 读写。
 *
 * <p>本类**不是** Spring Bean（本刀不装配 Spring 上下文：没有 HTTP 面与契约，装配只会在启动路径上多出一段没人消费的接线），
 * 由调用方（下一刀的 configuration）用 `JdbcTemplate` + `JsonMapper` 构造；集成测试也是这么构造的。
 */
public final class JdbcLibraryStore {
    private static final String NODE_COLUMNS =
        "id, tenant_id, owner_id, scope, parent_id, kind, title, depth, asset_id, created_at, updated_at";
    private static final String ASSET_COLUMNS =
        "id, tenant_id, owner_id, scope, node_id, name, kind, media_type, byte_length, "
            + "current_revision_id, status, source, created_at, updated_at";
    private static final String REVISION_COLUMNS =
        "id, tenant_id, owner_id, scope, asset_id, number, original_sha256, original_byte_length, "
            + "original_object_ref, content_sha256, content_byte_length, content_object_ref, "
            + "conversion_status, conversion_warnings, created_at";
    private static final String DRAFT_COLUMNS =
        "id, tenant_id, owner_id, scope, asset_id, base_revision_id, revision_token, content, "
            + "content_byte_length, created_by, created_at, updated_at";

    private static final String INSERT_NODE = """
        insert into ent_library_node(
            id, tenant_id, owner_id, scope, parent_id, kind, title, depth, asset_id, created_at, updated_at
        ) values (?,?,?,?,?,?,?,?,?,?,?)
        """;
    private static final String FIND_NODE =
        "select " + NODE_COLUMNS + " from ent_library_node where tenant_id=? and owner_id=? and id=?";
    private static final String LIST_NODES =
        "select " + NODE_COLUMNS + " from ent_library_node where tenant_id=? and owner_id=? order by id";
    private static final String DELETE_NODE =
        "delete from ent_library_node where tenant_id=? and owner_id=? and id=?";

    private static final String INSERT_ASSET = """
        insert into ent_library_asset(
            id, tenant_id, owner_id, scope, node_id, name, kind, media_type, byte_length,
            current_revision_id, status, source, created_at, updated_at
        ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """;
    private static final String FIND_ASSET =
        "select " + ASSET_COLUMNS + " from ent_library_asset where tenant_id=? and owner_id=? and id=?";
    private static final String LIST_ASSETS =
        "select " + ASSET_COLUMNS + " from ent_library_asset where tenant_id=? and owner_id=? order by id";
    private static final String DELETE_ASSET =
        "delete from ent_library_asset where tenant_id=? and owner_id=? and id=?";

    /**
     * 资产"当前修订"指针的 CAS 移动。
     *
     * `current_revision_id is not distinct from ?` 是这条 CAS 的全部要点：`from` 为 null（尚无修订）与为具体 id
     * 都能被精确匹配；受影响 0 行 ⇒ 别人在这中间挪过指针 ⇒ 调用方抛 `library/base-revision-conflict`。
     */
    private static final String MOVE_ASSET_CURRENT_REVISION = """
        update ent_library_asset
        set current_revision_id=?, byte_length=?, updated_at=?
        where tenant_id=? and owner_id=? and id=? and current_revision_id is not distinct from ?
        """;

    private static final String INSERT_REVISION = """
        insert into ent_library_revision(
            id, tenant_id, owner_id, scope, asset_id, number, original_sha256, original_byte_length,
            original_object_ref, content_sha256, content_byte_length, content_object_ref,
            conversion_status, conversion_warnings, created_at
        ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?)
        """;
    private static final String FIND_REVISION =
        "select " + REVISION_COLUMNS + " from ent_library_revision where tenant_id=? and owner_id=? and id=?";
    private static final String LIST_REVISIONS =
        "select " + REVISION_COLUMNS
            + " from ent_library_revision where tenant_id=? and owner_id=? and asset_id=? order by number";
    private static final String NEXT_REVISION_NUMBER =
        "select coalesce(max(number), 0) + 1 from ent_library_revision where asset_id=?";
    private static final String DELETE_REVISIONS_OF_ASSET =
        "delete from ent_library_revision where tenant_id=? and owner_id=? and asset_id=?";

    /**
     * 把资产的"当前修订"指针清空（级联删除里**先断环**的那一步）。
     *
     * `ent_library_asset.current_revision_id` 与 `ent_library_revision.asset_id` 互指成环，两张表的两个外键都是
     * restrict ⇒ 不先断指针就删不掉任何一侧。删除顺序因此固定为：引用 → 草稿 → **断指针** → 修订 → 资产 → 节点。
     */
    private static final String CLEAR_ASSET_CURRENT_REVISION = """
        update ent_library_asset set current_revision_id=null, updated_at=?
        where tenant_id=? and owner_id=? and id=?
        """;

    private static final String INSERT_DRAFT = """
        insert into ent_library_draft(
            id, tenant_id, owner_id, scope, asset_id, base_revision_id, revision_token, content,
            content_byte_length, created_by, created_at, updated_at
        ) values (?,?,?,?,?,?,?,?,?,?,?,?)
        """;
    private static final String FIND_DRAFT =
        "select " + DRAFT_COLUMNS + " from ent_library_draft where tenant_id=? and owner_id=? and id=?";
    private static final String LIST_DRAFTS =
        "select " + DRAFT_COLUMNS
            + " from ent_library_draft where tenant_id=? and owner_id=? order by updated_at desc, id";
    private static final String LIST_DRAFTS_OF_ASSET =
        "select " + DRAFT_COLUMNS
            + " from ent_library_draft where tenant_id=? and owner_id=? and asset_id=? order by updated_at desc, id";

    /**
     * 草稿正文的 CAS 更新：`revision_token = expectedToken` 不成立或草稿不在 ⇒ 受影响 0 行。
     *
     * 这一条 SQL 就是乐观锁的**真身**：读一次 token、写回时要求它没变，中间不需要任何行锁。
     */
    private static final String UPDATE_DRAFT_CONTENT = """
        update ent_library_draft
        set content=?, content_byte_length=?, revision_token=?, updated_at=?
        where tenant_id=? and owner_id=? and id=? and revision_token=?
        """;
    private static final String TOUCH_DRAFT = """
        update ent_library_draft
        set revision_token=?, updated_at=?
        where tenant_id=? and owner_id=? and id=? and revision_token=?
        """;
    private static final String DELETE_DRAFT =
        "delete from ent_library_draft where tenant_id=? and owner_id=? and id=?";
    private static final String DELETE_DRAFTS_OF_ASSET =
        "delete from ent_library_draft where tenant_id=? and owner_id=? and asset_id=?";

    private static final String INSERT_REFERENCE = """
        insert into ent_library_reference(
            id, tenant_id, owner_id, scope, session_id, node_id, sort_order, created_at
        ) values (?,?,?,?,?,?,?,?)
        on conflict (tenant_id, owner_id, session_id, node_id) do update set sort_order=excluded.sort_order
        """;
    private static final String LIST_REFERENCES =
        "select id, tenant_id, owner_id, scope, session_id, node_id, sort_order, created_at "
            + "from ent_library_reference where tenant_id=? and owner_id=? and session_id=? order by sort_order, id";
    private static final String DELETE_REFERENCES_OF_SESSION =
        "delete from ent_library_reference where tenant_id=? and owner_id=? and session_id=?";
    private static final String DELETE_REFERENCES_OF_NODE =
        "delete from ent_library_reference where tenant_id=? and owner_id=? and node_id=?";

    private final JdbcOperations jdbc;
    private final JsonMapper jsonMapper;
    /**
     * 修订行映射（**实例字段**而不是静态常量：它要用本实例的 JsonMapper 解 `conversion_warnings` 的 jsonb）。
     */
    private final RowMapper<LibraryRevision> revisionMapper;
    /** 告警数组的泛型载体（与 `JdbcPresetStore` / `JdbcSkillStore` 同一手法）。 */
    private static final TypeReference<List<String>> WARNINGS = new TypeReference<>() {
    };

    /**
     * 构造。
     *
     * @param jdbc Spring JDBC 操作面
     * @param jsonMapper Jackson 3 映射器（`conversion_warnings` 的 jsonb 编解码）
     */
    public JdbcLibraryStore(JdbcOperations jdbc, JsonMapper jsonMapper) {
        this.jdbc = jdbc;
        this.jsonMapper = jsonMapper;
        this.revisionMapper = (ResultSet rs, int row) -> new LibraryRevision(
            rs.getLong("id"),
            rs.getString("tenant_id"),
            rs.getString("owner_id"),
            LibraryScope.valueOf(rs.getString("scope")),
            rs.getLong("asset_id"),
            rs.getInt("number"),
            rs.getString("original_sha256"),
            rs.getLong("original_byte_length"),
            rs.getString("original_object_ref"),
            rs.getString("content_sha256"),
            rs.getLong("content_byte_length"),
            rs.getString("content_object_ref"),
            LibraryRevision.ConversionStatus.valueOf(rs.getString("conversion_status")),
            decodeWarnings(rs.getString("conversion_warnings")),
            instant(rs, "created_at")
        );
    }

    // ───────────────────────────── 节点 ─────────────────────────────

    /** 插入一个树节点。 */
    public void insertNode(LibraryNode node) {
        jdbc.update(
            INSERT_NODE,
            node.id(), node.tenantId(), node.ownerId(), node.scope().name(), node.parentId(),
            node.kind().name(), node.title(), node.depth(), node.assetId(),
            timestamp(node.createdAt()), timestamp(node.updatedAt())
        );
    }

    /** 按主体读一个节点（跨主体/不存在 ⇒ empty）。 */
    public Optional<LibraryNode> findNode(String tenantId, String ownerId, long id) {
        return jdbc.query(FIND_NODE, NODE_MAPPER, tenantId, ownerId, id).stream().findFirst();
    }

    /** 列本主体的全部节点。 */
    public List<LibraryNode> listNodes(String tenantId, String ownerId) {
        return jdbc.query(LIST_NODES, NODE_MAPPER, tenantId, ownerId);
    }

    /** 删一个节点（子节点必须先删：外键是 restrict）。 */
    public int deleteNode(String tenantId, String ownerId, long id) {
        return jdbc.update(DELETE_NODE, tenantId, ownerId, id);
    }

    // ───────────────────────────── 资产 ─────────────────────────────

    /** 插入一份资产。 */
    public void insertAsset(LibraryAsset asset) {
        jdbc.update(
            INSERT_ASSET,
            asset.id(), asset.tenantId(), asset.ownerId(), asset.scope().name(), asset.nodeId(),
            asset.name(), asset.kind().name(), asset.mediaType(), asset.byteLength(),
            asset.currentRevisionId(), asset.status().name(), asset.source().name(),
            timestamp(asset.createdAt()), timestamp(asset.updatedAt())
        );
    }

    /** 按主体读一份资产（跨主体/不存在 ⇒ empty）。 */
    public Optional<LibraryAsset> findAsset(String tenantId, String ownerId, long id) {
        return jdbc.query(FIND_ASSET, ASSET_MAPPER, tenantId, ownerId, id).stream().findFirst();
    }

    /** 列本主体的全部资产。 */
    public List<LibraryAsset> listAssets(String tenantId, String ownerId) {
        return jdbc.query(LIST_ASSETS, ASSET_MAPPER, tenantId, ownerId);
    }

    /** 删一份资产（修订与草稿必须先删：外键是 restrict）。 */
    public int deleteAsset(String tenantId, String ownerId, long id) {
        return jdbc.update(DELETE_ASSET, tenantId, ownerId, id);
    }

    /**
     * 把资产的"当前修订"指针从 `fromRevisionId` 移到 `toRevisionId`（CAS）。
     *
     * @param fromRevisionId 期望的旧值（可为 null = 期望"尚无修订"）
     * @return 受影响行数；0 = 期间有人挪过指针（调用方抛 `library/base-revision-conflict`）
     */
    public int moveAssetCurrentRevision(
        String tenantId,
        String ownerId,
        long assetId,
        Long fromRevisionId,
        long toRevisionId,
        long byteLength,
        Instant updatedAt
    ) {
        return jdbc.update(
            MOVE_ASSET_CURRENT_REVISION,
            toRevisionId, byteLength, timestamp(updatedAt), tenantId, ownerId, assetId, fromRevisionId
        );
    }

    // ───────────────────────────── 修订（只有 insert） ─────────────────────────────

    /** 插入一条不可变修订。 */
    public void insertRevision(LibraryRevision revision) {
        jdbc.update(
            INSERT_REVISION,
            revision.id(), revision.tenantId(), revision.ownerId(), revision.scope().name(),
            revision.assetId(), revision.number(), revision.originalSha256(), revision.originalByteLength(),
            revision.originalObjectRef(), revision.contentSha256(), revision.contentByteLength(),
            revision.contentObjectRef(), revision.conversionStatus().name(),
            encodeWarnings(revision.conversionWarnings()), timestamp(revision.createdAt())
        );
    }

    /** 按主体读一条修订。 */
    public Optional<LibraryRevision> findRevision(String tenantId, String ownerId, long id) {
        return jdbc.query(FIND_REVISION, revisionMapper, tenantId, ownerId, id).stream().findFirst();
    }

    /** 按版本号升序列出一份资产的修订。 */
    public List<LibraryRevision> listRevisions(String tenantId, String ownerId, long assetId) {
        return jdbc.query(LIST_REVISIONS, revisionMapper, tenantId, ownerId, assetId);
    }

    /** 下一个版本号（`coalesce(max(number),0)+1`；并发下由唯一索引兜底）。 */
    public int nextRevisionNumber(long assetId) {
        Integer next = jdbc.queryForObject(NEXT_REVISION_NUMBER, Integer.class, assetId);
        return next == null ? 1 : next;
    }

    /** 删掉一份资产的全部修订（级联删除按"先记录后对象"的顺序调用它）。 */
    public int deleteRevisionsOfAsset(String tenantId, String ownerId, long assetId) {
        return jdbc.update(DELETE_REVISIONS_OF_ASSET, tenantId, ownerId, assetId);
    }

    /**
     * 清空资产的当前修订指针（级联删除的"断环"步）。
     *
     * @return 受影响行数（0 = 资产不在该主体下）
     */
    public int clearAssetCurrentRevision(String tenantId, String ownerId, long assetId, Instant updatedAt) {
        return jdbc.update(CLEAR_ASSET_CURRENT_REVISION, timestamp(updatedAt), tenantId, ownerId, assetId);
    }

    // ───────────────────────────── 草稿 ─────────────────────────────

    /** 插入一份草稿。 */
    public void insertDraft(LibraryDraft draft) {
        jdbc.update(
            INSERT_DRAFT,
            draft.id(), draft.tenantId(), draft.ownerId(), draft.scope().name(), draft.assetId(),
            draft.baseRevisionId(), draft.revisionToken(), draft.content(), draft.contentByteLength(),
            draft.createdBy(), timestamp(draft.createdAt()), timestamp(draft.updatedAt())
        );
    }

    /** 按主体读一份草稿。 */
    public Optional<LibraryDraft> findDraft(String tenantId, String ownerId, long id) {
        return jdbc.query(FIND_DRAFT, DRAFT_MAPPER, tenantId, ownerId, id).stream().findFirst();
    }

    /** 列本主体的全部草稿（最近改动在前）。 */
    public List<LibraryDraft> listDrafts(String tenantId, String ownerId) {
        return jdbc.query(LIST_DRAFTS, DRAFT_MAPPER, tenantId, ownerId);
    }

    /** 列某份资产的草稿（最近改动在前）。 */
    public List<LibraryDraft> listDraftsOfAsset(String tenantId, String ownerId, long assetId) {
        return jdbc.query(LIST_DRAFTS_OF_ASSET, DRAFT_MAPPER, tenantId, ownerId, assetId);
    }

    /**
     * 改草稿正文（CAS：`revision_token` 必须还是 `expectedToken`）。
     *
     * @return 受影响行数；0 = token 不匹配或草稿不在（调用方抛 `library/revision-conflict`）
     */
    public int updateDraftContent(
        String tenantId,
        String ownerId,
        long draftId,
        String expectedToken,
        String content,
        long contentByteLength,
        String nextToken,
        Instant updatedAt
    ) {
        return jdbc.update(
            UPDATE_DRAFT_CONTENT,
            content, contentByteLength, nextToken, timestamp(updatedAt),
            tenantId, ownerId, draftId, expectedToken
        );
    }

    /**
     * 只换 token 与 updatedAt（发布路径用：正文不变，但草稿的"身份"变了）。
     *
     * @return 受影响行数；0 = token 不匹配或草稿不在
     */
    public int touchDraft(
        String tenantId,
        String ownerId,
        long draftId,
        String expectedToken,
        String nextToken,
        Instant updatedAt
    ) {
        return jdbc.update(TOUCH_DRAFT, nextToken, timestamp(updatedAt), tenantId, ownerId, draftId, expectedToken);
    }

    /** 删一份草稿（发布成功后草稿的生命周期结束）。 */
    public int deleteDraft(String tenantId, String ownerId, long id) {
        return jdbc.update(DELETE_DRAFT, tenantId, ownerId, id);
    }

    /** 删掉一份资产的全部草稿（级联删除用）。 */
    public int deleteDraftsOfAsset(String tenantId, String ownerId, long assetId) {
        return jdbc.update(DELETE_DRAFTS_OF_ASSET, tenantId, ownerId, assetId);
    }

    // ───────────────────────────── 引用 ─────────────────────────────

    /** 插入/更新一条会话引用（同会话同节点幂等：只改顺序）。 */
    public void upsertReference(LibraryReference reference) {
        jdbc.update(
            INSERT_REFERENCE,
            reference.id(), reference.tenantId(), reference.ownerId(), reference.scope().name(),
            reference.sessionId(), reference.nodeId(), reference.sortOrder(), timestamp(reference.createdAt())
        );
    }

    /** 按会话列引用（稳定顺序）。 */
    public List<LibraryReference> listReferences(String tenantId, String ownerId, String sessionId) {
        return jdbc.query(LIST_REFERENCES, REFERENCE_MAPPER, tenantId, ownerId, sessionId);
    }

    /** 清掉一个会话的全部引用（覆盖式设置选中集合的第一步）。 */
    public int deleteReferencesOfSession(String tenantId, String ownerId, String sessionId) {
        return jdbc.update(DELETE_REFERENCES_OF_SESSION, tenantId, ownerId, sessionId);
    }

    /** 删掉指向某个节点的全部引用（节点被删时剔除悬空引用）。 */
    public int deleteReferencesOfNode(String tenantId, String ownerId, long nodeId) {
        return jdbc.update(DELETE_REFERENCES_OF_NODE, tenantId, ownerId, nodeId);
    }

    // ───────────────────────────── 行映射与编解码 ─────────────────────────────

    private static final RowMapper<LibraryNode> NODE_MAPPER = (ResultSet rs, int row) -> new LibraryNode(
        rs.getLong("id"),
        rs.getString("tenant_id"),
        rs.getString("owner_id"),
        LibraryScope.valueOf(rs.getString("scope")),
        nullableLong(rs, "parent_id"),
        LibraryNode.Kind.valueOf(rs.getString("kind")),
        rs.getString("title"),
        rs.getInt("depth"),
        nullableLong(rs, "asset_id"),
        instant(rs, "created_at"),
        instant(rs, "updated_at")
    );

    private static final RowMapper<LibraryAsset> ASSET_MAPPER = (ResultSet rs, int row) -> new LibraryAsset(
        rs.getLong("id"),
        rs.getString("tenant_id"),
        rs.getString("owner_id"),
        LibraryScope.valueOf(rs.getString("scope")),
        rs.getLong("node_id"),
        rs.getString("name"),
        LibraryAsset.Kind.valueOf(rs.getString("kind")),
        rs.getString("media_type"),
        rs.getLong("byte_length"),
        nullableLong(rs, "current_revision_id"),
        LibraryAsset.Status.valueOf(rs.getString("status")),
        LibraryAsset.Source.valueOf(rs.getString("source")),
        instant(rs, "created_at"),
        instant(rs, "updated_at")
    );

    private static final RowMapper<LibraryDraft> DRAFT_MAPPER = (ResultSet rs, int row) -> new LibraryDraft(
        rs.getLong("id"),
        rs.getString("tenant_id"),
        rs.getString("owner_id"),
        LibraryScope.valueOf(rs.getString("scope")),
        rs.getLong("asset_id"),
        rs.getLong("base_revision_id"),
        rs.getString("revision_token"),
        rs.getString("content"),
        rs.getLong("content_byte_length"),
        rs.getLong("created_by"),
        instant(rs, "created_at"),
        instant(rs, "updated_at")
    );

    private static final RowMapper<LibraryReference> REFERENCE_MAPPER = (ResultSet rs, int row) -> new LibraryReference(
        rs.getLong("id"),
        rs.getString("tenant_id"),
        rs.getString("owner_id"),
        LibraryScope.valueOf(rs.getString("scope")),
        rs.getString("session_id"),
        rs.getLong("node_id"),
        rs.getInt("sort_order"),
        instant(rs, "created_at")
    );

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    /** 告警数组 → jsonb 文本（`[]` 也要落成合法 jsonb，故不写成 null）。 */
    private String encodeWarnings(List<String> warnings) {
        try {
            return jsonMapper.writeValueAsString(warnings == null ? List.of() : warnings);
        } catch (JacksonException exception) {
            throw new IllegalArgumentException("资料库转换告警不能序列化", exception);
        }
    }

    /** jsonb 文本 → 告警数组（坏值按空数组处理：告警是旁证，不该让它把一条修订读不出来）。 */
    private List<String> decodeWarnings(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<String> decoded = jsonMapper.readValue(json, WARNINGS);
            return decoded == null ? List.of() : decoded;
        } catch (JacksonException exception) {
            return List.of();
        }
    }
}
