/**
 * [INPUT]: 依赖空数据库、classpath V0–V44 migration 与 V43 的五张资料库表。
 * [OUTPUT]: 资料库五张表的**真迁移读数**（空库迁移到 latest 后 `flyway.info().current()` 的版本号必为 44、五张表都在）与逐条约束的**行为证明**（重号被拒、草稿 8 MiB 上限、枚举白名单、树形状自洽、外键 restrict）。
 * [POS]: library 的持续 migration 门禁：它证明这些表不是"文档里写过"，而是**真在库上**且**约束真的拦得住坏数据**。
 * [PROTOCOL]: 变更时更新此头部并同步 EnterpriseMigrationTest 的版本/表计数断言，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library;

import com.owndsh.enterprise.test.PostgresTestDatabase;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class LibraryMigrationTest {
    private static final List<String> TABLES = List.of(
        "ent_library_node", "ent_library_asset", "ent_library_revision", "ent_library_draft", "ent_library_reference"
    );

    @Test
    void migratesToVersion44AndCreatesTheFiveLibraryTables() {
        var database = PostgresTestDatabase.create("library_migration");
        var flyway = PostgresTestDatabase.migrate(database, null);

        // 真迁移读数：不是"应该有 V44"，而是 Flyway 自己报的当前版本。
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("44");
        for (String table : TABLES) {
            assertThat(database.jdbc().queryForObject("""
                select count(*) from information_schema.tables
                where table_schema='public' and table_name=?
                """, Integer.class, table)).as(table).isEqualTo(1);
        }
        // 修订表**故意没有 updated_at**（不可覆盖的 schema 级表达）。
        assertThat(database.jdbc().queryForList("""
            select column_name from information_schema.columns
            where table_schema='public' and table_name='ent_library_revision'
            """, String.class)).doesNotContain("updated_at");
    }

    @Test
    void enforcesTheConstraintsThatProtectTheDraftLifecycle() {
        var database = PostgresTestDatabase.create("library_constraints");
        PostgresTestDatabase.migrate(database, null);
        long departmentId = database.jdbc().queryForObject(
            "select dept_id from sys_dept where status='0' order by dept_id limit 1", Long.class
        );
        PostgresTestDatabase.insertActiveUser(database, 7001L, departmentId, "library_author", "资料库作者");
        seedAsset(database);

        // 唯一索引把"两个并发发布算出同一个版本号"挡在库层。
        database.jdbc().update("""
            insert into ent_library_revision(id,tenant_id,owner_id,scope,asset_id,number,original_sha256,
                original_byte_length,original_object_ref,content_sha256,content_byte_length,content_object_ref,
                conversion_status,conversion_warnings,created_at)
            values (9001,'000000','7001','PERSONAL',8001,1,repeat('a',64),3,
                'objects/8001/9001/original.md',repeat('b',64),3,'objects/8001/9001/content.md',
                'READY','[]'::jsonb,now())
            """);
        assertThatThrownBy(() -> database.jdbc().update("""
            insert into ent_library_revision(id,tenant_id,owner_id,scope,asset_id,number,original_sha256,
                original_byte_length,original_object_ref,content_sha256,content_byte_length,content_object_ref,
                conversion_status,conversion_warnings,created_at)
            values (9002,'000000','7001','PERSONAL',8001,1,repeat('c',64),3,
                'objects/8001/9002/original.md',repeat('d',64),3,'objects/8001/9002/content.md',
                'READY','[]'::jsonb,now())
            """)).hasMessageContaining("ux_ent_library_revision_number");

        // 草稿正文上限 8 MiB。
        assertThatThrownBy(() -> database.jdbc().update("""
            insert into ent_library_draft(id,tenant_id,owner_id,scope,asset_id,base_revision_id,revision_token,
                content,content_byte_length,created_by,created_at,updated_at)
            values (9101,'000000','7001','PERSONAL',8001,9001,'token-a',repeat('x', 8388609),8388609,7001,now(),now())
            """)).hasMessageContaining("ck_ent_library_draft_content_size");

        // 字节数与正文长度必须自洽。
        assertThatThrownBy(() -> database.jdbc().update("""
            insert into ent_library_draft(id,tenant_id,owner_id,scope,asset_id,base_revision_id,revision_token,
                content,content_byte_length,created_by,created_at,updated_at)
            values (9102,'000000','7001','PERSONAL',8001,9001,'token-b','abc',99,7001,now(),now())
            """)).hasMessageContaining("ck_ent_library_draft_content_length");

        // 格式白名单（少一个多一个都不行）。
        assertThatThrownBy(() -> database.jdbc().update("""
            insert into ent_library_asset(id,tenant_id,owner_id,scope,node_id,name,kind,media_type,byte_length,
                current_revision_id,status,source,created_at,updated_at)
            values (8002,'000000','7001','PERSONAL',7002,'x','XLSX','text/plain',0,null,'ACTIVE','UPLOAD',now(),now())
            """)).hasMessageContaining("ck_ent_library_asset_kind");

        // 节点形状自洽：文件夹不许挂资产。
        assertThatThrownBy(() -> database.jdbc().update("""
            insert into ent_library_node(id,tenant_id,owner_id,scope,parent_id,kind,title,depth,asset_id,created_at,updated_at)
            values (7003,'000000','7001','PERSONAL',null,'FOLDER','坏节点',0,8001,now(),now())
            """)).hasMessageContaining("ck_ent_library_node_asset");

        // 外键是 restrict：删掉还有修订的资产会被拒（删除必须由应用显式按顺序递归）。
        assertThatThrownBy(() -> database.jdbc().update(
            "delete from ent_library_asset where tenant_id='000000' and id=8001"
        )).hasMessageContaining("fk_ent_library_revision_asset");

        // 草稿的基准修订外键同样是 restrict：删掉还被草稿引用的修订会被拒。
        database.jdbc().update("""
            insert into ent_library_draft(id,tenant_id,owner_id,scope,asset_id,base_revision_id,revision_token,
                content,content_byte_length,created_by,created_at,updated_at)
            values (9103,'000000','7001','PERSONAL',8001,9001,'token-c','abc',3,7001,now(),now())
            """);
        assertThatThrownBy(() -> database.jdbc().update(
            "delete from ent_library_revision where tenant_id='000000' and id=9001"
        )).hasMessageContaining("fk_ent_library_draft_base_revision");
    }

    /** 造一条 node + asset + revision 的最小事实（约束测试的底座）。 */
    private static void seedAsset(PostgresTestDatabase.Database database) {
        database.jdbc().update("""
            insert into ent_library_node(id,tenant_id,owner_id,scope,parent_id,kind,title,depth,asset_id,created_at,updated_at)
            values (7002,'000000','7001','PERSONAL',null,'ASSET','发布规范.md',0,8001,now(),now())
            """);
        database.jdbc().update("""
            insert into ent_library_asset(id,tenant_id,owner_id,scope,node_id,name,kind,media_type,byte_length,
                current_revision_id,status,source,created_at,updated_at)
            values (8001,'000000','7001','PERSONAL',7002,'发布规范.md','MARKDOWN','text/markdown',0,null,'ACTIVE','UPLOAD',now(),now())
            """);
    }
}
