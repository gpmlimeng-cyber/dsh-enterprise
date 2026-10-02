/**
 * [INPUT]: 依赖 V35 技能表、JdbcSkillStore、SkillArtifactStore/Inspector 与 Spring 事务模板（真 PostgreSQL）。
 * [OUTPUT]: 验证上传在真库真盘上落包、同一 uploadId 幂等复用、非技能归档被校验器拒绝。
 * [POS]: skill 服务层的第一个真实数据库门禁；此前该纵向只有 artifact 的纯函数测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import com.owndsh.enterprise.skill.artifact.SkillArtifactInspector;
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.persistence.JdbcSkillStore;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Tag("dev")
class SkillCatalogServiceIntegrationTest {

    private static final String TENANT = "000000";
    private static final long ACTOR_ID = 1L;

    private static PostgresTestDatabase.Database database;
    private static Path artifactRoot;
    private static JsonMapper json;

    @BeforeAll
    static void migrateDatabase() throws IOException {
        database = PostgresTestDatabase.create("skill_catalog");
        PostgresTestDatabase.migrate(database, null);
        // ent_skill_version.created_by 有外键指向 sys_user，测试必须先把操作者种进去。
        PostgresTestDatabase.insertActiveUser(database, ACTOR_ID, 100L, "it-actor", "集成测试操作者");
        artifactRoot = Files.createTempDirectory("skill-artifacts");
        json = JsonMapper.builder().build();
    }

    /** 递增 revision 的内存替身：技能发布要比较并递增 revision，测试里不需要跨进程一致。 */
    private static BootstrapRevisionStore revisions() {
        return new BootstrapRevisionStore() {
            private long revision = 1L;

            @Override
            public long current(String tenantId) {
                return revision;
            }

            @Override
            public long increment(String tenantId) {
                return ++revision;
            }

            @Override
            public long compareAndIncrement(String tenantId, long expectedRevision) {
                if (expectedRevision != revision) {
                    throw new IllegalStateException("revision 冲突");
                }
                return ++revision;
            }
        };
    }

    private static SkillCatalogService catalog() {
        SkillArtifactStore artifacts = new SkillArtifactStore(artifactRoot, 8L * 1024L * 1024L);
        SkillArtifactInspector inspector = new SkillArtifactInspector(json, 8L * 1024L * 1024L, 64);
        AuditSink audit = (AuditEvent event) -> {
            // 审计写入不在本测试的判据内，忽略事件即可。
        };
        return new SkillCatalogService(
            new TransactionTemplate(new DataSourceTransactionManager(database.dataSource())),
            new JdbcSkillStore(database.jdbc(), json),
            artifacts,
            inspector,
            revisions(),
            audit,
            new java.util.concurrent.atomic.AtomicLong(1L)::getAndIncrement
        );
    }

    private static SkillMutationContext context() {
        return new SkillMutationContext(TENANT, 1L, "req_01K2ZJ4Y8K7W4R5S6T7V8X9YZA", "127.0.0.1", new byte[32]);
    }

    /** 造一个结构合法的技能包归档：根 manifest.json + skills/<name>/SKILL.md。 */
    private static InputStream validArtifact() throws IOException {
        return artifact(
            "{\"format\":\"dsh-skill\",\"version\":\"1\",\"id\":\"it-skill\",\"name\":\"集成测试技能\",\"sourceDshVersion\":\"0.2.0-rc.2\"}",
            "---\nname: it-skill\ndescription: 集成测试用的最小技能条目。\n---\n\n# 集成测试技能\n\n正文。\n"
        );
    }

    /** 缺少 manifest.json 的归档：校验器必须拒绝。 */
    private static InputStream missingManifestArtifact() throws IOException {
        return artifact(null, "---\nname: it-skill\ndescription: 没有 manifest 的包。\n---\n\n正文。\n");
    }

    private static InputStream artifact(String manifest, String skillMarkdown) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            if (manifest != null) {
                zip.putNextEntry(new ZipEntry("manifest.json"));
                zip.write(manifest.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("skills/it-skill/SKILL.md"));
            zip.write(skillMarkdown.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return new java.io.ByteArrayInputStream(buffer.toByteArray());
    }

    @Test
    void uploadsAPackageIntoTheRealSchemaAndReplaysTheSameUploadId() throws IOException {
        SkillCatalogService catalog = catalog();
        UUID uploadId = UUID.randomUUID();
        SkillMutationContext context = context();

        try (InputStream input = validArtifact()) {
            SkillCatalogService.UploadResult first = catalog.upload(context, uploadId, input, null);
            assertThat(first.created()).isTrue();
        }

        // 同一个 uploadId 重放：必须复用既有版本，而不是再落一条。
        try (InputStream input = validArtifact()) {
            SkillCatalogService.UploadResult replay = catalog.upload(context, uploadId, input, null);
            assertThat(replay.created()).isFalse();
        }
    }

    @Test
    void rejectsAnArtifactWithoutManifest() throws IOException {
        SkillCatalogService catalog = catalog();
        try (InputStream input = missingManifestArtifact()) {
            assertThatThrownBy(() -> catalog.upload(context(), UUID.randomUUID(), input, null))
                .isInstanceOf(RuntimeException.class);
        }
    }
}
