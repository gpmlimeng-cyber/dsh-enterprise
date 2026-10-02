/**
 * [INPUT]: 依赖 V37 技能表、JdbcSkillStore、SkillCatalogService/SkillRuntimeService、真 PostgreSQL 与真 .dshskill 归档字节。
 * [OUTPUT]: 验证 category 列形状与存储层空白/长度约束、manifest 声明经上传落库、包级分类随每个新版本刷新、管理端与员工端（摘要/详情）两处投影的取值与 null 形状、以及无分类包的既有上传/发布/分配/可见性回归。
 * [POS]: skill 纵向分类能力的数据库门禁；口径是"NULL 表示没有分类"，纯空白由验包层与数据库层双重拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.device.domain.DeviceStatus;
import com.owndsh.enterprise.device.domain.EnterpriseDevice;
import com.owndsh.enterprise.model.application.BootstrapUser;
import com.owndsh.enterprise.model.persistence.BootstrapUserStore;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import com.owndsh.enterprise.skill.artifact.SkillArtifactException;
import com.owndsh.enterprise.skill.artifact.SkillArtifactInspector;
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.domain.RuntimeSkill;
import com.owndsh.enterprise.skill.domain.SkillAssignment;
import com.owndsh.enterprise.skill.domain.SkillPackage;
import com.owndsh.enterprise.skill.domain.SkillVersion;
import com.owndsh.enterprise.skill.persistence.JdbcSkillStore;
import com.owndsh.enterprise.skill.web.SkillViews;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Tag("dev")
class SkillCategoryIntegrationTest {
    private static final String TENANT = "000000";
    private static final long ACTOR_ID = 1L;
    private static final long MEMBER_ID = 2L;
    private static final String CATEGORY = "办公效率";
    private static final AtomicLong IDS = new AtomicLong(1_931_500_000_000_000_000L);
    private static final AtomicLong HASHES = new AtomicLong(1L);

    private static PostgresTestDatabase.Database database;
    private static JsonMapper json;
    private static Path artifactRoot;

    @BeforeAll
    static void migrateDatabase() throws IOException {
        database = PostgresTestDatabase.create("skill_category");
        PostgresTestDatabase.migrate(database, null);
        // ent_skill_version.created_by 有外键指向 sys_user，操作者与员工必须先种进去。
        PostgresTestDatabase.insertActiveUser(database, ACTOR_ID, 100L, "category-actor", "分类操作者");
        PostgresTestDatabase.insertActiveUser(database, MEMBER_ID, 100L, "category-member", "分类员工");
        json = JsonMapper.builder().build();
        artifactRoot = Files.createTempDirectory("skill-category-artifacts");
    }

    private static JdbcSkillStore store() {
        return new JdbcSkillStore(database.jdbc(), json);
    }

    /** 上传走真实 inspector/artifact store，只把从不参与上传的 bootstrap revision 换成替身。 */
    private static SkillCatalogService catalog() {
        return new SkillCatalogService(
            new TransactionTemplate(new DataSourceTransactionManager(database.dataSource())),
            store(),
            new SkillArtifactStore(artifactRoot, 8L * 1024L * 1024L),
            new SkillArtifactInspector(json, 8L * 1024L * 1024L, 64),
            mock(BootstrapRevisionStore.class),
            event -> {
            },
            IDS::incrementAndGet
        );
    }

    private record RuntimeFixture(SkillRuntimeService service, DeviceService devices, DeviceCallContext context) {
    }

    /** 员工端 runtime 编排：设备与用户目录用替身，其余走真实 PostgreSQL adapter。 */
    private static RuntimeFixture runtimeFixture() {
        DeviceService devices = mock(DeviceService.class);
        EnterpriseDevice device = new EnterpriseDevice(
            9001L, TENANT, MEMBER_ID, "category-member", "分类员工", UUID.randomUUID(),
            "integration-device", "linux", "0.2.0-rc.2", "0.1.0",
            DeviceStatus.ACTIVE, Instant.parse("2026-10-01T00:00:00Z"), null, 0
        );
        when(devices.requireActive(any(DeviceCallContext.class))).thenReturn(device);
        BootstrapUserStore users = (tenantId, userId) -> Optional.of(
            new BootstrapUser(userId, "category-user-" + userId, "集成测试成员", 100L)
        );
        AuditSink audit = event -> {
        };
        SkillRuntimeService service = new SkillRuntimeService(
            new TransactionTemplate(new DataSourceTransactionManager(database.dataSource())),
            devices, users, store(),
            new SkillArtifactStore(artifactRoot, 8L * 1024L * 1024L),
            audit, IDS::incrementAndGet
        );
        DeviceCallContext context = new DeviceCallContext(
            TENANT,
            new PlatformSession(MEMBER_ID, PlatformClient.DSH_DESKTOP, "harness", "device-1"),
            "req_01K2ZJ4Y8K7W4R5S6T7V8X9YZA", "127.0.0.1", new byte[32]
        );
        return new RuntimeFixture(service, devices, context);
    }

    private static SkillMutationContext context() {
        return new SkillMutationContext(TENANT, ACTOR_ID, "req_01K2ZJ4Y8K7W4R5S6T7V8X9YZA", "127.0.0.1", new byte[32]);
    }

    private static long insertPackage(String skillId, String category) {
        long id = IDS.incrementAndGet();
        database.jdbc().update("""
            insert into ent_skill_package
            (id, tenant_id, skill_id, display_name, description, category, status, revision)
            values (?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
            """, id, TENANT, skillId, skillId, "集成测试技能 " + skillId, category);
        return id;
    }

    private static long insertVersion(long packageId, String skillId, String status) {
        long id = IDS.incrementAndGet();
        String sha256 = "%064x".formatted(HASHES.incrementAndGet());
        String skills = ("[{\"name\":\"%s\",\"description\":\"集成测试技能条目。\","
            + "\"modelInvocable\":true,\"userInvocable\":true}]").formatted(skillId);
        database.jdbc().update("""
            insert into ent_skill_version
            (id, tenant_id, package_id, source_dsh_version, artifact_ref, size_bytes, sha256, status,
             skill_count, skills, created_by, created_at, revision)
            values (?, ?, ?, '0.2.0-rc.2', ?, 1024, ?, ?, 1, ?::jsonb, ?, now(), 0)
            """, id, TENANT, packageId, "sha256:" + sha256, sha256, status, skills, ACTOR_ID);
        return id;
    }

    private static void insertAllAssignment(long packageId) {
        database.jdbc().update("""
            insert into ent_skill_assignment
            (id, tenant_id, package_id, subject_type, subject_id, status, revision)
            values (?, ?, ?, 'ALL', null, 'ACTIVE', 0)
            """, IDS.incrementAndGet(), TENANT, packageId);
    }

    private static SkillPackage storedPackage(long packageId) {
        return store().findPackageById(TENANT, packageId).orElseThrow();
    }

    private static String storedCategory(String skillId) {
        return store().findPackageBySkillIdForUpdate(TENANT, skillId).orElseThrow().category();
    }

    private static List<SkillViews.PackageView> adminPage(long afterId, int limit) {
        return catalog().list(TENANT, afterId, limit).stream().map(SkillViews::packageView).toList();
    }

    /** 员工端列表投影里取指定包的那一条 summary。 */
    private static SkillViews.RuntimeSummaryView summaryOf(RuntimeFixture fixture, long packageId) {
        return fixture.service().list(fixture.context()).stream()
            .filter(value -> value.packageId() == packageId)
            .map(SkillViews::runtime)
            .findFirst()
            .orElseThrow();
    }

    private static void uploadSkill(String skillId, String sourceDshVersion, String categoryJson) throws IOException {
        try (InputStream input = artifact(skillId, sourceDshVersion, categoryJson)) {
            SkillCatalogService.UploadResult result = catalog().upload(context(), UUID.randomUUID(), input, null);
            assertThat(result.created()).isTrue();
        }
    }

    /** 造一个结构合法的技能包归档；categoryJson 为 null 表示 manifest 不声明 category。 */
    private static InputStream artifact(String skillId, String sourceDshVersion, String categoryJson) throws IOException {
        String category = categoryJson == null ? "" : ",\"category\":" + categoryJson;
        String manifest = ("{\"format\":\"dsh-skill\",\"version\":\"1\",\"id\":\"%s\",\"name\":\"分类集成测试技能\","
            + "\"description\":\"分类集成测试。\",\"sourceDshVersion\":\"%s\"%s}")
            .formatted(skillId, sourceDshVersion, category);
        String skillMarkdown = ("---\nname: %s\ndescription: 分类集成测试用的最小技能条目。\n---\n\n# 分类集成测试技能\n\n正文。\n")
            .formatted(skillId);
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(manifest.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("skills/" + skillId + "/SKILL.md"));
            zip.write(skillMarkdown.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return new ByteArrayInputStream(buffer.toByteArray());
    }

    /**
     * 绕开 Spring 的异常翻译直接读 JDBC SQLState，精确证明是"数据库拒绝"而不是别的失败。
     *
     * @return null 表示写入成功，否则返回 SQLState
     */
    private static String rawInsertSqlState(String skillId, String category) throws SQLException {
        try (Connection connection = database.dataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                 insert into ent_skill_package
                 (id, tenant_id, skill_id, display_name, description, category, status, revision)
                 values (?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
                 """)) {
            statement.setLong(1, IDS.incrementAndGet());
            statement.setString(2, TENANT);
            statement.setString(3, skillId);
            statement.setString(4, skillId);
            statement.setString(5, "集成测试技能 " + skillId);
            statement.setString(6, category);
            statement.executeUpdate();
            return null;
        } catch (SQLException exception) {
            return exception.getSQLState();
        }
    }

    /** 迁移必须加的是可空 varchar(32)、无默认值，并带拒绝空白的检查约束。 */
    @Test
    void migrationAddsNullableCategoryColumnWithThirtyTwoCharLimit() {
        assertThat(database.jdbc().queryForObject("""
            select count(*) from information_schema.columns
            where table_name = 'ent_skill_package' and column_name = 'category'
              and data_type = 'character varying' and is_nullable = 'YES'
              and character_maximum_length = 32 and column_default is null
            """, Integer.class)).isOne();
        assertThat(database.jdbc().queryForObject("""
            select count(*) from pg_constraint
            where conname = 'ck_ent_skill_package_category' and contype = 'c'
              and conrelid = 'ent_skill_package'::regclass
            """, Integer.class)).isOne();
    }

    /** 存储边界：NULL 合法，空串/纯空白是 23514，超长是 22001，32 字符正好合法。 */
    @Test
    void categoryColumnRejectsEmptyBlankAndOverlongValuesAtTheStorageBoundary() throws SQLException {
        assertThat(rawInsertSqlState("cat-db-null", null)).isNull();
        assertThat(rawInsertSqlState("cat-db-empty", "")).isEqualTo("23514");
        assertThat(rawInsertSqlState("cat-db-blank", "   ")).isEqualTo("23514");
        assertThat(rawInsertSqlState("cat-db-overlong", "x".repeat(33))).isEqualTo("22001");
        assertThat(rawInsertSqlState("cat-db-boundary", "x".repeat(32))).isNull();

        assertThat(storedCategory("cat-db-boundary")).hasSize(32);
    }

    /** 没有分类的包在管理端与员工端两处投影都必须是 null，而不是空串。 */
    @Test
    void packageWithoutCategoryProjectsNullInAdminAndBothRuntimeViews() {
        long packageId = insertPackage("cat-absent-view", null);
        insertVersion(packageId, "cat-absent-view", "PUBLISHED");
        insertAllAssignment(packageId);

        assertThat(storedPackage(packageId).category()).isNull();
        assertThat(adminPage(packageId - 1, 1).getFirst().category()).isNull();

        RuntimeFixture fixture = runtimeFixture();
        SkillViews.RuntimeSummaryView summary = summaryOf(fixture, packageId);
        assertThat(summary.category()).isNull();
        assertThat(SkillViews.runtimeDetail(fixture.service().detail(fixture.context(), packageId)).category()).isNull();

        // 契约形状是 string|null：缺席出显式 null，绝不改写成空串（前端两者都不渲染标签）。
        assertThat(json.writeValueAsString(summary))
            .contains("\"category\":null")
            .doesNotContain("\"category\":\"\"");
    }

    /** 前端依赖点：管理端列表、员工端摘要与员工端详情三处投影都必须透传分类值。 */
    @Test
    void categoryValuePassesThroughToAdminAndBothRuntimeViews() {
        long packageId = insertPackage("cat-present-view", CATEGORY);
        insertVersion(packageId, "cat-present-view", "PUBLISHED");
        insertAllAssignment(packageId);

        assertThat(storedPackage(packageId).category()).isEqualTo(CATEGORY);
        assertThat(adminPage(packageId - 1, 1).getFirst().category()).isEqualTo(CATEGORY);

        RuntimeFixture fixture = runtimeFixture();
        // 员工端 summary 投影：技能列表标题行的分类标签依赖这里。
        SkillViews.RuntimeSummaryView summary = summaryOf(fixture, packageId);
        assertThat(summary.category()).isEqualTo(CATEGORY);
        assertThat(json.writeValueAsString(summary)).contains("\"category\":\"" + CATEGORY + "\"");
        // 员工端 detail 投影：与 summary 同源带出同一个声明值。
        SkillViews.RuntimeDetailView detail = SkillViews.runtimeDetail(
            fixture.service().detail(fixture.context(), packageId)
        );
        assertThat(detail.category()).isEqualTo(CATEGORY);
        assertThat(json.writeValueAsString(detail)).contains("\"category\":\"" + CATEGORY + "\"");
    }

    /** 上传全链路：manifest 的 category 落进包，且位置参数型 record 的既有标记/状态不被挤位。 */
    @Test
    void uploadPersistsManifestCategoryAndKeepsMarksDefaults() throws IOException {
        uploadSkill("cat-upload", "0.2.0-rc.2", "\"研发工具\"");

        SkillPackage stored = store().findPackageBySkillIdForUpdate(TENANT, "cat-upload").orElseThrow();
        assertThat(stored.category()).isEqualTo("研发工具");
        assertThat(stored.builtin()).isFalse();
        assertThat(stored.featured()).isFalse();
        assertThat(stored.status()).isEqualTo(SkillPackage.Status.ACTIVE);
        assertThat(stored.revision()).isEqualTo(1);
    }

    /** 包级分类以最后一次上传的 manifest 声明为准：可改、可撤销（归 null），每次新版本都递增包 revision。 */
    @Test
    void uploadRefreshesPackageCategoryOnEveryNewVersionIncludingRemoval() throws IOException {
        uploadSkill("cat-refresh", "0.2.0-rc.2", "\"研发工具\"");
        assertThat(storedCategory("cat-refresh")).isEqualTo("研发工具");

        uploadSkill("cat-refresh", "0.2.0-rc.3", "\"办公效率\"");
        assertThat(storedCategory("cat-refresh")).isEqualTo("办公效率");

        uploadSkill("cat-refresh", "0.2.0-rc.4", null);
        assertThat(storedCategory("cat-refresh")).isNull();

        assertThat(store().findPackageBySkillIdForUpdate(TENANT, "cat-refresh").orElseThrow().revision())
            .isEqualTo(3);
    }

    /** 验包失败必须整笔拒绝：纯空白与超长分类都不得留下半成品包。 */
    @Test
    void uploadRejectsBlankAndOverlongCategoryManifestsWithoutLeavingAPackage() {
        assertThatThrownBy(() -> uploadSkill("cat-upload-blank", "0.2.0-rc.2", "\"   \""))
            .isInstanceOf(SkillArtifactException.class);
        assertThatThrownBy(() -> uploadSkill("cat-upload-overlong", "0.2.0-rc.2", "\"" + "x".repeat(33) + "\""))
            .isInstanceOf(SkillArtifactException.class);

        assertThat(store().findPackageBySkillIdForUpdate(TENANT, "cat-upload-blank")).isEmpty();
        assertThat(store().findPackageBySkillIdForUpdate(TENANT, "cat-upload-overlong")).isEmpty();
    }

    /** 包级分类写入与标记写入同口径：过期 revision 必须拒绝，且不产生半写状态。 */
    @Test
    void updatePackageCategoryUsesRevisionCas() {
        long packageId = insertPackage("cat-cas", null);

        assertThat(store().updatePackageCategory(TENANT, packageId, "研发工具", 7)).isFalse();
        assertThat(storedPackage(packageId).category()).isNull();

        assertThat(store().updatePackageCategory(TENANT, packageId, "研发工具", 0)).isTrue();
        SkillPackage updated = storedPackage(packageId);
        assertThat(updated.category()).isEqualTo("研发工具");
        assertThat(updated.revision()).isEqualTo(1);
    }

    /** 回归：不带 category 的包，上传/发布/分配/运行时可见与下载/退休行为与改动前一致。 */
    @Test
    void packagesWithoutCategoryKeepExistingUploadPublishAssignAndVisibilityBehavior() throws IOException {
        uploadSkill("cat-regression", "0.2.0-rc.2", null);
        SkillPackage created = store().findPackageBySkillIdForUpdate(TENANT, "cat-regression").orElseThrow();
        assertThat(created.category()).isNull();
        assertThat(created.status()).isEqualTo(SkillPackage.Status.ACTIVE);

        SkillVersion validated = store().listVersions(TENANT, created.id()).getFirst();
        assertThat(validated.status()).isEqualTo(SkillVersion.Status.VALIDATED);
        SkillVersion published = catalog().publish(context(), validated.id(), validated.revision());
        assertThat(published.status()).isEqualTo(SkillVersion.Status.PUBLISHED);

        long packageRevision = storedPackage(created.id()).revision();
        assertThat(catalog().replaceAssignments(
            context(), created.id(), packageRevision,
            List.of(new SkillCatalogService.AssignmentSpec(SkillAssignment.SubjectType.ALL, null))
        )).hasSize(1);

        RuntimeFixture fixture = runtimeFixture();
        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .contains(created.id());
        RuntimeSkill detail = fixture.service().detail(fixture.context(), created.id());
        assertThat(detail.versionId()).isEqualTo(published.id());
        assertThat(detail.category()).isNull();
        assertThat(fixture.service().authorizeDownload(fixture.context(), published.id()).sizeBytes()).isPositive();

        SkillVersion retired = catalog().retire(context(), published.id(), published.revision());
        assertThat(retired.status()).isEqualTo(SkillVersion.Status.RETIRED);
        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .doesNotContain(created.id());
        assertThatThrownBy(() -> fixture.service().detail(fixture.context(), created.id()))
            .isInstanceOf(SkillAccessException.class);
    }
}
