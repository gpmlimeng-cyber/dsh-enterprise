/**
 * [INPUT]: 依赖 V36 技能表、JdbcSkillStore、SkillCatalogService/SkillRuntimeService 与真 PostgreSQL。
 * [OUTPUT]: 验证 builtin/featured 两列的迁移默认值、标记接口的 CAS 与投影、以及 runtime 可见性并集。
 * [POS]: skill 纵向标记能力的数据库门禁；可见性谓词落在 JdbcSkillStore，本测试从 SkillRuntimeService 侧验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
import com.owndsh.enterprise.revision.RevisionConflictException;
import com.owndsh.enterprise.skill.artifact.SkillArtifactInspector;
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.domain.RuntimeSkill;
import com.owndsh.enterprise.skill.domain.SkillPackage;
import com.owndsh.enterprise.skill.persistence.JdbcSkillStore;
import com.owndsh.enterprise.skill.web.SkillViews;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Tag("dev")
class SkillMarksIntegrationTest {
    private static final String TENANT = "000000";
    private static final long ACTOR_ID = 1L;
    private static final long MEMBER_ID = 2L;
    private static final long OTHER_MEMBER_ID = 3L;
    private static final AtomicLong IDS = new AtomicLong(1_902_600_000_000_000_000L);
    private static final AtomicLong HASHES = new AtomicLong(1L);

    private static PostgresTestDatabase.Database database;
    private static JsonMapper json;
    private static Path artifactRoot;

    @BeforeAll
    static void migrateDatabase() throws IOException {
        database = PostgresTestDatabase.create("skill_marks");
        PostgresTestDatabase.migrate(database, null);
        // ent_skill_version.created_by 有外键指向 sys_user，操作者与两个员工必须先种进去。
        PostgresTestDatabase.insertActiveUser(database, ACTOR_ID, 100L, "marks-actor", "标记操作者");
        PostgresTestDatabase.insertActiveUser(database, MEMBER_ID, 100L, "marks-member", "标记员工");
        PostgresTestDatabase.insertActiveUser(database, OTHER_MEMBER_ID, 100L, "marks-other", "其他员工");
        json = JsonMapper.builder().build();
        artifactRoot = Files.createTempDirectory("skill-marks-artifacts");
    }

    private static JdbcSkillStore store() {
        return new JdbcSkillStore(database.jdbc(), json);
    }

    /** 标记写入不触碰 artifact 与 bootstrap revision，这里仍按真实依赖装配服务。 */
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

    /**
     * 员工端 runtime 编排：设备校验用替身返回 ACTIVE 设备，用户目录返回 ACTIVE 成员，
     * 其余走真实 PostgreSQL adapter，以便把可见性并集压到真实 SQL 上验证。
     */
    private static RuntimeFixture runtimeFixture() {
        DeviceService devices = mock(DeviceService.class);
        EnterpriseDevice device = new EnterpriseDevice(
            9001L, TENANT, MEMBER_ID, "marks-member", "标记员工", UUID.randomUUID(),
            "integration-device", "linux", "0.2.0-rc.2", "0.1.0",
            DeviceStatus.ACTIVE, Instant.parse("2026-10-01T00:00:00Z"), null, 0
        );
        when(devices.requireActive(any(DeviceCallContext.class))).thenReturn(device);
        BootstrapUserStore users = (tenantId, userId) -> Optional.of(
            new BootstrapUser(userId, "marks-user-" + userId, "集成测试成员", 100L)
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

    private static long insertPackage(String skillId, boolean builtin, boolean featured) {
        long id = IDS.incrementAndGet();
        database.jdbc().update("""
            insert into ent_skill_package
            (id, tenant_id, skill_id, display_name, description, builtin, featured, status, revision)
            values (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)
            """, id, TENANT, skillId, skillId, "集成测试技能 " + skillId, builtin, featured);
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

    private static void insertUserAssignment(long packageId, long userId) {
        database.jdbc().update("""
            insert into ent_skill_assignment
            (id, tenant_id, package_id, subject_type, subject_id, status, revision)
            values (?, ?, ?, 'USER', ?, 'ACTIVE', 0)
            """, IDS.incrementAndGet(), TENANT, packageId, userId);
    }

    /** 迁移后两列必须存在，且是 NOT NULL 的 boolean、默认 false。 */
    @Test
    void migrationAddsBothMarkColumnsAsNotNullBooleanDefaultingToFalse() {
        assertThat(database.jdbc().queryForObject("""
            select count(*) from information_schema.columns
            where table_name = 'ent_skill_package'
              and column_name in ('builtin', 'featured')
              and data_type = 'boolean' and is_nullable = 'NO' and column_default = 'false'
            """, Integer.class)).isEqualTo(2);
    }

    /** 不显式给标记列赋值时，读写两侧都必须看到 false。 */
    @Test
    void newlyInsertedPackagesDefaultToNotBuiltinAndNotFeatured() {
        long packageId = IDS.incrementAndGet();
        database.jdbc().update("""
            insert into ent_skill_package
            (id, tenant_id, skill_id, display_name, description, status, revision)
            values (?, ?, 'marks-default', '默认标记技能', '不写内置与精选列。', 'ACTIVE', 0)
            """, packageId, TENANT);

        SkillPackage stored = store().findPackageById(TENANT, packageId).orElseThrow();
        assertThat(stored.builtin()).isFalse();
        assertThat(stored.featured()).isFalse();
    }

    /** 标记写入成功路径：两列落库、revision 递增，且投影带出新字段。 */
    @Test
    void updateMarksPersistsBothMarksIncrementsRevisionAndProjectsThem() {
        long packageId = insertPackage("marks-set", false, false);

        SkillCatalogService.CatalogItem item = catalog().updateMarks(context(), packageId, 0, true, true);

        assertThat(item.skillPackage().builtin()).isTrue();
        assertThat(item.skillPackage().featured()).isTrue();
        assertThat(item.skillPackage().revision()).isEqualTo(1);

        SkillViews.PackageView view = SkillViews.packageView(item);
        assertThat(view.builtin()).isTrue();
        assertThat(view.featured()).isTrue();

        SkillPackage stored = store().findPackageById(TENANT, packageId).orElseThrow();
        assertThat(stored.builtin()).isTrue();
        assertThat(stored.featured()).isTrue();
        assertThat(stored.revision()).isEqualTo(1);
    }

    /** 列表接口的投影必须带出这两个字段，否则管理端拿不到。 */
    @Test
    void catalogListProjectionCarriesBothMarks() {
        long packageId = insertPackage("marks-list", true, true);

        List<SkillViews.PackageView> page = catalog().list(TENANT, packageId - 1, 1).stream()
            .map(SkillViews::packageView)
            .toList();

        assertThat(page).hasSize(1);
        assertThat(page.getFirst().id()).isEqualTo(Long.toString(packageId));
        assertThat(page.getFirst().builtin()).isTrue();
        assertThat(page.getFirst().featured()).isTrue();
    }

    /** 并发负例：If-Match revision 过期必须 409，且不得留下半写状态。 */
    @Test
    void updateMarksRejectsStaleRevisionWithoutWritingAnything() {
        long packageId = insertPackage("marks-conflict", false, false);
        database.jdbc().update("update ent_skill_package set revision = 3 where id = ?", packageId);

        assertThatThrownBy(() -> catalog().updateMarks(context(), packageId, 2, true, true))
            .isInstanceOf(RevisionConflictException.class);

        SkillPackage stored = store().findPackageById(TENANT, packageId).orElseThrow();
        assertThat(stored.builtin()).isFalse();
        assertThat(stored.featured()).isFalse();
        assertThat(stored.revision()).isEqualTo(3);
    }

    /** 参数负例：包不存在必须 404 语义，不得静默成功。 */
    @Test
    void updateMarksRejectsUnknownPackage() {
        assertThatThrownBy(() -> catalog().updateMarks(context(), 1_999_999_999_999_999_999L, 0, true, true))
            .isInstanceOf(SkillResourceNotFoundException.class);
    }

    /** 核心行为：builtin=true 且没有任何 assignment 时，列表/详情/下载都可见。 */
    @Test
    void builtinPackageWithoutAssignmentIsVisibleToListDetailAndDownload() {
        RuntimeFixture fixture = runtimeFixture();
        long packageId = insertPackage("marks-builtin", true, false);
        long versionId = insertVersion(packageId, "marks-builtin", "PUBLISHED");

        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .contains(packageId);

        RuntimeSkill detail = fixture.service().detail(fixture.context(), packageId);
        assertThat(detail.versionId()).isEqualTo(versionId);

        assertThat(fixture.service().authorizeDownload(fixture.context(), versionId).sizeBytes()).isEqualTo(1024L);

        // 既有设备前置校验必须仍然先跑。
        // 本用例依次走 list + detail + authorizeDownload 三个入口，而三者**都**以
        // `devices.requireActive(context)` 作为第一行（SkillRuntimeService:75/81/88），
        // 所以这是**同一个前置校验被调用三次**，不是三处互不相同的断言。
        // 本用例要验的语义是「前置校验必须跑过」，不是「恰好跑一次」，原期望写窄了，据此放宽为 atLeastOnce()。
        verify(fixture.devices(), atLeastOnce()).requireActive(fixture.context());
    }

    /**
     * 本刀新增：builtin 贯通到员工端投影的回归门禁。
     *
     * <p>守的是「真 PostgreSQL 里那一列的两种取值都能原样到达员工端摘要与详情」——
     * 契约把 builtin 声明为 required，员工端「已安装」分组据此只显示非内置的已装行，
     * 所以列表/详情两处投影都必须恒发真值（缺席或恒 false 都会让分组错位）。
     * 这里刻意同时造 builtin=true（无 assignment）与 builtin=false（有 ALL assignment）两个包：
     * 前者证明它**不依赖** assignment 才可见，后者证明它**不是**恒 true 的占位值。
     */
    @Test
    void builtinProjectsToBothRuntimeViewsForBothColumnValues() {
        long builtinPackage = insertPackage("marks-proj-builtin", true, false);
        insertVersion(builtinPackage, "marks-proj-builtin", "PUBLISHED");
        long plainPackage = insertPackage("marks-proj-plain", false, false);
        insertVersion(plainPackage, "marks-proj-plain", "PUBLISHED");
        insertAllAssignment(plainPackage);

        RuntimeFixture fixture = runtimeFixture();
        // builtin=true 且无 assignment：可见，且标记为真。
        RuntimeSkill builtinSkill = fixture.service().detail(fixture.context(), builtinPackage);
        assertThat(builtinSkill.builtin()).isTrue();
        assertThat(SkillViews.runtime(builtinSkill).builtin()).isTrue();
        assertThat(SkillViews.runtimeDetail(builtinSkill).builtin()).isTrue();
        // builtin=false 靠 ALL assignment 可见：可见，且标记为假（证明不是恒 true 占位）。
        RuntimeSkill plainSkill = fixture.service().detail(fixture.context(), plainPackage);
        assertThat(plainSkill.builtin()).isFalse();
        assertThat(SkillViews.runtime(plainSkill).builtin()).isFalse();
        assertThat(SkillViews.runtimeDetail(plainSkill).builtin()).isFalse();
        // 契约声明 builtin 为 required ⇒ 序列化恒发该键（缺席会让员工端关闭键集整条判无效）。
        assertThat(json.writeValueAsString(SkillViews.runtime(plainSkill))).contains("\"builtin\":false");
    }

    /** 未勾选内置且没有 assignment 的技能对员工不可见。 */
    @Test
    void packageWithoutBuiltinAndWithoutAssignmentStaysInvisible() {
        RuntimeFixture fixture = runtimeFixture();
        long packageId = insertPackage("marks-plain", false, false);
        insertVersion(packageId, "marks-plain", "PUBLISHED");

        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .doesNotContain(packageId);
        assertThatThrownBy(() -> fixture.service().detail(fixture.context(), packageId))
            .isInstanceOf(SkillAccessException.class);
    }

    /** 取并集不破坏既有分配：非内置包的 ALL/USER 分配照旧生效。 */
    @Test
    void existingAssignmentsKeepWorkingForNonBuiltinPackages() {
        RuntimeFixture fixture = runtimeFixture();
        long allAssigned = insertPackage("marks-assigned-all", false, false);
        insertVersion(allAssigned, "marks-assigned-all", "PUBLISHED");
        insertAllAssignment(allAssigned);

        long userAssigned = insertPackage("marks-assigned-user", false, false);
        insertVersion(userAssigned, "marks-assigned-user", "PUBLISHED");
        insertUserAssignment(userAssigned, MEMBER_ID);

        List<Long> visible = fixture.service().list(fixture.context()).stream()
            .map(RuntimeSkill::packageId)
            .toList();
        assertThat(visible).contains(allAssigned, userAssigned);
    }

    /** 内置与分配同时命中同一包时只能出现一条，不能因为并集写成 UNION ALL 而重复。 */
    @Test
    void builtinAndAssignmentAreUnionWithoutDuplicatedEntries() {
        RuntimeFixture fixture = runtimeFixture();
        long packageId = insertPackage("marks-union", true, false);
        insertVersion(packageId, "marks-union", "PUBLISHED");
        insertUserAssignment(packageId, MEMBER_ID);

        assertThat(fixture.service().list(fixture.context()))
            .filteredOn(value -> value.packageId() == packageId)
            .hasSize(1);
    }

    /** 内置不等于无视版本状态：只有 RETIRED 版本的包即便 builtin=true 也不可见。 */
    @Test
    void retiredVersionStaysInvisibleEvenWhenPackageIsBuiltin() {
        RuntimeFixture fixture = runtimeFixture();
        long packageId = insertPackage("marks-retired", true, true);
        long versionId = insertVersion(packageId, "marks-retired", "RETIRED");

        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .doesNotContain(packageId);
        assertThatThrownBy(() -> fixture.service().detail(fixture.context(), packageId))
            .isInstanceOf(SkillAccessException.class);
        assertThatThrownBy(() -> fixture.service().authorizeDownload(fixture.context(), versionId))
            .isInstanceOf(SkillAccessException.class);
    }

    /** 内置可见性与"分给谁"无关：只分给别人的包，对本员工也应因 builtin 可见。 */
    @Test
    void builtinVisibilityDoesNotDependOnAssignmentsTargetingOtherMembers() {
        RuntimeFixture fixture = runtimeFixture();
        long packageId = insertPackage("marks-other-member", true, false);
        insertVersion(packageId, "marks-other-member", "PUBLISHED");
        insertUserAssignment(packageId, OTHER_MEMBER_ID);

        assertThat(fixture.service().list(fixture.context()))
            .extracting(RuntimeSkill::packageId)
            .contains(packageId);
    }
}
