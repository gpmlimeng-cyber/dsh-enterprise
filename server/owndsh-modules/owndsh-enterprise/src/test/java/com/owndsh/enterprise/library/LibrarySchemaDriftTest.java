/**
 * [INPUT]: 依赖空库 + classpath V0–V43 migration 的 `information_schema` / `pg_indexes` 真值。
 * [OUTPUT]: 五张资料库表的**列名与顺序快照**、每张表的约束名集合、索引名集合三份写死的清单比对——多一列、少一列、改名、换序、丢约束/丢索引都红。
 * [POS]: library 的 schema 漂移门禁。它与 `LibraryMigrationTest` 的分工：那条证明"约束拦得住坏数据"（行为），这条证明"形状没有被无声改动"（结构）。两者共用同一门 dev 组。
 * [PROTOCOL]: 变更时更新此头部；迁移里列/约束/索引一改，这里的清单必须同批更新（否则就是"顺手改了没说"），然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library;

import com.owndsh.enterprise.test.PostgresTestDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class LibrarySchemaDriftTest {
    private static PostgresTestDatabase.Database database;

    @BeforeAll
    static void migrateOnce() {
        database = PostgresTestDatabase.create("library_schema_drift");
        PostgresTestDatabase.migrate(database, null);
    }

    /**
     * 列名与顺序（`information_schema.columns.ordinal_position`）。
     *
     * 顺序也在锁内：列序是 `select *`、`insert ... values` 省略列名、以及人工 `\\d` 排障时的一致前提。
     */
    private static final Map<String, List<String>> COLUMNS = Map.of(
        "ent_library_node", List.of(
            "id", "tenant_id", "owner_id", "scope", "parent_id", "kind", "title", "depth", "asset_id",
            "created_at", "updated_at"
        ),
        "ent_library_asset", List.of(
            "id", "tenant_id", "owner_id", "scope", "node_id", "name", "kind", "media_type", "byte_length",
            "current_revision_id", "status", "source", "created_at", "updated_at"
        ),
        "ent_library_revision", List.of(
            "id", "tenant_id", "owner_id", "scope", "asset_id", "number", "original_sha256",
            "original_byte_length", "original_object_ref", "content_sha256", "content_byte_length",
            "content_object_ref", "conversion_status", "conversion_warnings", "created_at"
        ),
        "ent_library_draft", List.of(
            "id", "tenant_id", "owner_id", "scope", "asset_id", "base_revision_id", "revision_token",
            "content", "content_byte_length", "created_by", "created_at", "updated_at"
        ),
        "ent_library_reference", List.of(
            "id", "tenant_id", "owner_id", "scope", "session_id", "node_id", "sort_order", "created_at"
        )
    );

    @Test
    void keepsTheColumnSetsOfTheFiveLibraryTablesExactly() {
        for (Map.Entry<String, List<String>> entry : COLUMNS.entrySet()) {
            List<String> actual = database.jdbc().queryForList("""
                select column_name from information_schema.columns
                where table_schema='public' and table_name=?
                order by ordinal_position
                """, String.class, entry.getKey());
            assertThat(actual).as(entry.getKey()).isEqualTo(entry.getValue());
        }
    }

    /** 约束名集合（check 与 foreign key 一起锁：改名断掉的是"报错文本里的可诊断性"）。 */
    private static final Map<String, List<String>> CONSTRAINTS = Map.of(
        "ent_library_node", List.of(
            "ck_ent_library_node_scope", "ck_ent_library_node_kind", "ck_ent_library_node_title",
            "ck_ent_library_node_depth", "ck_ent_library_node_asset", "fk_ent_library_node_parent"
        ),
        "ent_library_asset", List.of(
            "ck_ent_library_asset_scope", "ck_ent_library_asset_name", "ck_ent_library_asset_kind",
            "ck_ent_library_asset_media_type", "ck_ent_library_asset_byte_length", "ck_ent_library_asset_status",
            "ck_ent_library_asset_source", "fk_ent_library_asset_node", "fk_ent_library_asset_current_revision"
        ),
        "ent_library_revision", List.of(
            "ck_ent_library_revision_scope", "ck_ent_library_revision_number",
            "ck_ent_library_revision_original_sha256", "ck_ent_library_revision_content_sha256",
            "ck_ent_library_revision_byte_length", "ck_ent_library_revision_conversion_status",
            "ck_ent_library_revision_warnings", "fk_ent_library_revision_asset"
        ),
        "ent_library_draft", List.of(
            "ck_ent_library_draft_scope", "ck_ent_library_draft_token", "ck_ent_library_draft_content_length",
            "ck_ent_library_draft_content_size", "fk_ent_library_draft_asset",
            "fk_ent_library_draft_base_revision", "fk_ent_library_draft_author"
        ),
        "ent_library_reference", List.of(
            "ck_ent_library_reference_scope", "ck_ent_library_reference_session",
            "ck_ent_library_reference_order", "fk_ent_library_reference_node"
        )
    );

    @Test
    void keepsTheConstraintNamesOfTheFiveLibraryTablesExactly() {
        for (Map.Entry<String, List<String>> entry : CONSTRAINTS.entrySet()) {
            List<String> actual = database.jdbc().queryForList("""
                select conname from pg_constraint
                where conrelid = cast(? as regclass) and contype in ('c','f')
                order by conname
                """, String.class, entry.getKey());
            // 约束名的**集合**是锁定对象；`order by conname` 只是让读数稳定，故期望清单按同一规则排序。
            assertThat(actual).as(entry.getKey()).isEqualTo(entry.getValue().stream().sorted().toList());
        }
    }

    /** 索引名集合（唯一闸与查询索引一起锁：少一条唯一索引 = 少一道并发兜底）。 */
    private static final Map<String, List<String>> INDEXES = Map.of(
        "ent_library_node", List.of(
            "ux_ent_library_node_sibling_title", "ix_ent_library_node_parent", "ix_ent_library_node_asset"
        ),
        "ent_library_asset", List.of(
            "ux_ent_library_asset_node", "ix_ent_library_asset_owner", "ix_ent_library_asset_name"
        ),
        "ent_library_revision", List.of("ux_ent_library_revision_number", "ix_ent_library_revision_asset"),
        "ent_library_draft", List.of("ix_ent_library_draft_asset", "ix_ent_library_draft_owner"),
        "ent_library_reference", List.of("ux_ent_library_reference_node", "ix_ent_library_reference_session")
    );

    @Test
    void keepsTheIndexNamesOfTheFiveLibraryTablesExactly() {
        for (Map.Entry<String, List<String>> entry : INDEXES.entrySet()) {
            List<String> actual = database.jdbc().queryForList("""
                select indexname from pg_indexes
                where schemaname='public' and tablename=? and indexname not like '%_pkey'
                order by indexname
                """, String.class, entry.getKey());
            assertThat(actual).as(entry.getKey()).isEqualTo(entry.getValue().stream().sorted().toList());
        }
    }
}
