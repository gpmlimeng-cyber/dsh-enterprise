/**
 * [INPUT]: 依赖真实 PostgreSQL 17/Flyway V1-V13、三个显式活动用户 fixture、CAS 文件、Ed25519、设备与插件 JDBC/application 服务。
 * [OUTPUT]: 验证无签名上传/存储/HTTP 投影与有签名版本并存、并发上传、可选可见范围、退休下架/禁止优先级回退、下载授权、库存、审计 action 与 resource_type/resource_id 关联和文件补偿。
 * [POS]: T13 服务端纵向验收，跨越 artifact、domain、persistence 与 application 的真实事务边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.audit.JdbcAuditSink;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.application.PlatformSessionGateway;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.device.persistence.JdbcDeviceStore;
import com.owndsh.enterprise.model.persistence.JdbcBootstrapUserStore;
import com.owndsh.enterprise.plugin.application.EffectivePluginResolver;
import com.owndsh.enterprise.plugin.application.PluginAccessException;
import com.owndsh.enterprise.plugin.application.PluginCatalogService;
import com.owndsh.enterprise.plugin.application.PluginMutationContext;
import com.owndsh.enterprise.plugin.application.PluginRuntimeService;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactNormalizer;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactStore;
import com.owndsh.enterprise.plugin.artifact.PluginManifestSigner;
import com.owndsh.enterprise.plugin.domain.DevicePluginInventory;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.persistence.JdbcPluginStore;
import com.owndsh.enterprise.plugin.web.PluginViews;
import com.owndsh.enterprise.revision.JdbcBootstrapRevisionStore;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

@Tag("dev")
class PluginServerIntegrationTest {
    private static final String TENANT = "000000";
    private static final long ADMIN_USER = 1_901_300_000_000_900_001L;
    private static final long PEER_USER = 1_901_300_000_000_900_002L;
    private static final long OTHER_USER = 1_901_300_000_000_900_003L;
    private static final long ADMIN_DEPT = 1_761_000_000_000_000_103L;
    private static final long OTHER_DEPT = 1_761_000_000_000_000_108L;
    private static final long ADMIN_DEVICE = 1_901_300_000_000_900_011L;
    private static final long PEER_DEVICE = 1_901_300_000_000_900_012L;
    private static final UUID ADMIN_INSTALLATION = UUID.fromString("123e4567-e89b-42d3-a456-426614174013");
    private static final UUID PEER_INSTALLATION = UUID.fromString("123e4567-e89b-42d3-a456-426614174014");
    private static final Instant OBSERVED_AT = Instant.parse("2026-08-19T03:00:00Z");

    private static PostgresTestDatabase.Database database;

    @TempDir
    Path artifactRoot;

    @BeforeAll
    static void createDatabase() {
        database = PostgresTestDatabase.create("t13_plugin_server");
        PostgresTestDatabase.migrate(database, null);
        PostgresTestDatabase.insertActiveUser(
            database, ADMIN_USER, ADMIN_DEPT, "t13-admin", "T13 Admin"
        );
        PostgresTestDatabase.insertActiveUser(
            database, PEER_USER, ADMIN_DEPT, "t13-peer", "T13 Peer"
        );
        PostgresTestDatabase.insertActiveUser(
            database, OTHER_USER, OTHER_DEPT, "t13-other", "T13 Other"
        );
        insertDevice(ADMIN_DEVICE, ADMIN_USER, ADMIN_INSTALLATION, "T13 Admin Desktop");
        insertDevice(PEER_DEVICE, PEER_USER, PEER_INSTALLATION, "T13 Peer Desktop");
    }

    @Test
    void completesPluginLifecycleResolutionAuthorizationInventoryAndCompensation() throws Exception {
        JsonMapper json = JsonMapper.builder().build();
        var jdbc = database.jdbc();
        var transaction = new TransactionTemplate(new DataSourceTransactionManager(database.dataSource()));
        var store = new JdbcPluginStore(jdbc, json);
        var revisions = new JdbcBootstrapRevisionStore(jdbc);
        var audit = new JdbcAuditSink(jdbc, json);
        var artifacts = new PluginArtifactStore(artifactRoot, 2_000_000);
        // 本测试只上传 @example/* 非核心包，故传最小非空集合即可放行；权威清单由
        // contracts/plugin-core-packages.json 经配置注入，绝不在此复制，其一致性由 PluginCorePackageContractTest 断言。
        var inspector = new PluginArtifactInspector(json, 8_000_000, 100, Set.of("dshent-plugin"));
        // 归一化器与 inspector 用同一组上限，与 EnterprisePluginConfiguration 的装配保持一致。
        var normalizer = new PluginArtifactNormalizer(8_000_000, 100);
        var signer = new PluginManifestSigner(
            json, KeyPairGenerator.getInstance("Ed25519").generateKeyPair().getPrivate()
        );
        AtomicLong sequence = new AtomicLong(1_901_300_000_100_000_000L);
        LongSupplier ids = sequence::incrementAndGet;
        PluginCatalogService catalog = new PluginCatalogService(
            transaction, store, artifacts, normalizer, inspector, signer, revisions, audit, ids
        );
        PluginCatalogService unsignedCatalog = new PluginCatalogService(
            transaction, store, artifacts, normalizer, inspector,
            new EnterprisePluginConfiguration().enterprisePluginManifestSigner(json, new EnterprisePluginProperties()),
            revisions, audit, ids
        );
        EffectivePluginResolver resolver = new EffectivePluginResolver(store, revisions);
        DeviceService devices = new DeviceService(
            transaction, new JdbcDeviceStore(jdbc), audit, mock(PlatformSessionGateway.class), ids
        );
        PluginRuntimeService runtime = new PluginRuntimeService(
            transaction, devices, new JdbcBootstrapUserStore(jdbc), resolver, store, artifacts, audit, ids
        );
        PluginMutationContext mutation = mutationContext();
        PluginCompatibility compatibility = compatibility();

        byte[] versionOneBytes = PluginTestArtifacts.validArchive("@example/t13-tools", "1.0.0");
        List<PluginCatalogService.UploadResult> duplicates = concurrentUploads(
            unsignedCatalog, mutation, compatibility, versionOneBytes
        );
        assertThat(duplicates).filteredOn(PluginCatalogService.UploadResult::created).hasSize(1);
        assertThat(duplicates).extracting(result -> result.version().id()).containsOnly(
            duplicates.getFirst().version().id()
        );
        PluginVersion versionOne = duplicates.getFirst().version();
        assertThat(versionOne.signature()).isEmpty();
        assertThat(PluginViews.version(versionOne).signatureBase64()).isEmpty();
        assertThat(jdbc.queryForObject("select octet_length(signature) from ent_plugin_version where id=?",
            Integer.class, versionOne.id())).isZero();
        assertThat(catalog.upload(mutation, UUID.randomUUID(), new ByteArrayInputStream(versionOneBytes), compatibility)
            .version().signature()).isEmpty();
        assertThat(versionOne.status()).isEqualTo(PluginVersion.Status.VALIDATED);
        assertThat(versionOne.revision()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from ent_plugin_version", Long.class)).isEqualTo(1);
        PluginVersion publishedOne = catalog.publish(mutation, versionOne.id(), versionOne.revision());
        assertThat(publishedOne.status()).isEqualTo(PluginVersion.Status.PUBLISHED);

        byte[] versionTwoBytes = PluginTestArtifacts.validArchive("@example/t13-tools", "2.0.0");
        PluginVersion versionTwo = catalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(versionTwoBytes), compatibility
        ).version();
        assertThat(versionTwo.signature()).hasSize(64);
        PluginVersion publishedTwo = catalog.publish(mutation, versionTwo.id(), versionTwo.revision());
        long packageId = publishedOne.packageId();
        assertThat(publishedTwo.packageId()).isEqualTo(packageId);
        assertThat(catalog.list(TENANT, 0, 10)).singleElement().satisfies(item -> {
            assertThat(item.pluginPackage().revision()).isEqualTo(3);
            assertThat(item.versions()).hasSize(2);
        });

        long revisionBeforeAssignments = revisions.current(TENANT);
        List<PluginAssignment> assignments = catalog.replaceAssignments(
            mutation, packageId, 3, List.of(
                spec(publishedOne.id(), PluginAssignment.SubjectType.ALL, null,
                    PluginAssignment.DesiredState.INSTALLED, false),
                spec(publishedTwo.id(), PluginAssignment.SubjectType.DEPT, ADMIN_DEPT,
                    PluginAssignment.DesiredState.INSTALLED, true),
                spec(publishedOne.id(), PluginAssignment.SubjectType.USER, ADMIN_USER,
                    PluginAssignment.DesiredState.ABSENT, false)
            )
        );
        assertThat(assignments).hasSize(3);
        assertThat(assignments).allMatch(value -> !value.required());
        assertThat(revisions.current(TENANT)).isEqualTo(revisionBeforeAssignments + 1);
        assertThat(catalog.list(TENANT, 0, 10)).singleElement().satisfies(item -> {
            assertThat(item.pluginPackage().revision()).isEqualTo(4);
            assertThat(item.assignments()).containsExactlyElementsOf(assignments);
        });
        assertResolved(resolver.resolve(TENANT, ADMIN_USER, ADMIN_DEPT), publishedOne.id(), "ABSENT");
        assertResolved(resolver.resolve(TENANT, PEER_USER, ADMIN_DEPT), publishedTwo.id(), "INSTALLED");
        assertResolved(resolver.resolve(TENANT, OTHER_USER, OTHER_DEPT), publishedOne.id(), "INSTALLED");

        assertThat(PluginViews.runtime(resolver.resolve(TENANT, OTHER_USER, OTHER_DEPT))
            .assignments().getFirst().signatureBase64()).isEmpty();
        assertThat(PluginViews.runtime(resolver.resolve(TENANT, PEER_USER, ADMIN_DEPT))
            .assignments().getFirst().signatureBase64()).hasSize(88);

        DeviceCallContext adminContext = runtimeContext(ADMIN_USER, ADMIN_INSTALLATION);
        DeviceCallContext peerContext = runtimeContext(PEER_USER, PEER_INSTALLATION);
        assertThatThrownBy(() -> runtime.authorizeDownload(adminContext, publishedOne.id()))
            .isInstanceOf(PluginAccessException.class);
        assertThatThrownBy(() -> runtime.authorizeDownload(peerContext, publishedOne.id()))
            .isInstanceOf(PluginAccessException.class);
        PluginRuntimeService.AuthorizedDownload initialDownload = runtime.authorizeDownload(
            peerContext, publishedTwo.id()
        );
        assertThat(Files.readAllBytes(initialDownload.path())).isEqualTo(versionTwoBytes);

        PluginVersion retiredTwo = catalog.retire(mutation, publishedTwo.id(), publishedTwo.revision());
        assertThat(retiredTwo.status()).isEqualTo(PluginVersion.Status.RETIRED);
        assertThat(resolver.resolve(TENANT, PEER_USER, ADMIN_DEPT).assignments()).isEmpty();
        assertThatThrownBy(() -> runtime.authorizeDownload(peerContext, retiredTwo.id()))
            .isInstanceOf(PluginAccessException.class);
        assertResolved(resolver.resolve(TENANT, OTHER_USER, OTHER_DEPT), publishedOne.id(), "INSTALLED");
        assertThat(catalog.list(TENANT, 0, 10).getFirst().pluginPackage().revision()).isEqualTo(5);

        List<PluginRuntimeService.InventoryObservation> firstInventory = List.of(
            observation("@example/t13-tools", "2.0.0", retiredTwo.sha256(), 4,
                DevicePluginInventory.State.ACTIVE, "active", null),
            observation("@example/removed", null, null, 4,
                DevicePluginInventory.State.REMOVE_PENDING, null, null)
        );
        assertThat(runtime.replaceInventory(peerContext, firstInventory)).isEqualTo(2);
        assertThat(runtime.replaceInventory(peerContext, List.of(
            observation("@example/t13-tools", "2.0.0", retiredTwo.sha256(), 5,
                DevicePluginInventory.State.FAILED, "failed", "ENT_PLUGIN_INSTALL_FAILED")
        ))).isEqualTo(1);
        assertThat(catalog.listInventory(TENANT, 0, 10)).singleElement().satisfies(value -> {
            assertThat(value.username()).isEqualTo("t13-peer");
            assertThat(value.state()).isEqualTo(DevicePluginInventory.State.FAILED);
            assertThat(value.desiredRevision()).isEqualTo(5);
        });
        assertThatThrownBy(() -> runtime.replaceInventory(peerContext, List.of(
            firstInventory.getFirst(), firstInventory.getFirst()
        ))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("重复");
        assertThat(jdbc.queryForObject("select count(*) from ent_device_plugin", Long.class)).isEqualTo(1);

        assertThat(jdbc.queryForObject(
            "select count(*) from ent_audit_event where action='PLUGIN_UPLOADED'", Long.class
        )).isEqualTo(2);
        assertThat(jdbc.queryForObject(
            "select count(*) from ent_audit_event where action='PLUGIN_PUBLISHED'", Long.class
        )).isEqualTo(3);
        assertThat(jdbc.queryForObject(
            "select count(*) from ent_audit_event where action='PLUGIN_ASSIGNED'", Long.class
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "select count(*) from ent_audit_event where action='PLUGIN_DOWNLOADED'", Long.class
        )).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
            select count(*) from ent_audit_event
            where action='PLUGIN_DOWNLOADED' and resource_type='PLUGIN_VERSION' and resource_id=?
            """, Long.class, Long.toString(publishedTwo.id()))).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "select count(*) from ent_audit_event where action='PLUGIN_INVENTORY_REPORTED'", Long.class
        )).isEqualTo(2);
        assertThat(jdbc.queryForObject("""
            select count(*) from ent_audit_event
            where action='PLUGIN_INVENTORY_REPORTED' and resource_type='DEVICE' and resource_id=?
            """, Long.class, Long.toString(PEER_DEVICE))).isEqualTo(2);
        assertThat(revisions.current(TENANT)).isEqualTo(revisionBeforeAssignments + 2);
        assertThat(artifactCount()).isEqualTo(2);
        assertDirectoryEmpty(artifactRoot.resolve("tmp"));

        PluginCatalogService failingCatalog = new PluginCatalogService(
            transaction, store, artifacts, normalizer, inspector, signer, revisions,
            event -> { throw new IllegalStateException("forced audit rollback"); }, ids
        );
        byte[] rollbackBytes = PluginTestArtifacts.validArchive("@example/t13-rollback", "1.0.0");
        assertThatThrownBy(() -> failingCatalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(rollbackBytes), compatibility
        )).isInstanceOf(IllegalStateException.class).hasMessage("forced audit rollback");
        assertThat(jdbc.queryForObject(
            "select count(*) from ent_plugin_package where package_name='@example/t13-rollback'", Long.class
        )).isZero();
        assertThat(artifactCount()).isEqualTo(2);
        assertDirectoryEmpty(artifactRoot.resolve("tmp"));
    }

    /**
     * zip 上传的端到端验收：员工端用 `dsh plugin add` 安装走的是 npm/pnpm 语义，两者都只吃 gzip tar，
     * 所以"上传成功"必须等价于"CAS 里躺着的是规范 npm tgz"，否则就是一个装不上的假功能。
     */
    @Test
    void normalizesZipAndGitHubWrappedUploadsIntoTgzBeforeTheContentAddressedStore() throws Exception {
        // 本用例独立建库：既有用例对 ent_plugin_version/审计/制品做的是全表计数，
        // 共用同一个库会让"全表恰好 1 行"这类断言被本用例的上传污染，那是测试耦合而不是产品缺陷。
        PostgresTestDatabase.Database isolated = PostgresTestDatabase.create("t13_plugin_zip");
        PostgresTestDatabase.migrate(isolated, null);
        PostgresTestDatabase.insertActiveUser(
            isolated, ADMIN_USER, ADMIN_DEPT, "t13-zip-admin", "T13 Zip Admin"
        );
        JsonMapper json = JsonMapper.builder().build();
        var jdbc = isolated.jdbc();
        var transaction = new TransactionTemplate(new DataSourceTransactionManager(isolated.dataSource()));
        var store = new JdbcPluginStore(jdbc, json);
        var revisions = new JdbcBootstrapRevisionStore(jdbc);
        var audit = new JdbcAuditSink(jdbc, json);
        var artifacts = new PluginArtifactStore(artifactRoot, 2_000_000);
        var normalizer = new PluginArtifactNormalizer(8_000_000, 100);
        var inspector = new PluginArtifactInspector(json, 8_000_000, 100, Set.of("dshent-plugin"));
        var catalog = new PluginCatalogService(
            transaction, store, artifacts, normalizer, inspector,
            new PluginManifestSigner(json, null), revisions, audit,
            new AtomicLong(1_901_300_000_200_000_000L)::incrementAndGet
        );
        PluginMutationContext mutation = mutationContext();
        PluginCompatibility compatibility = compatibility();

        byte[] zip = PluginTestArtifacts.validZipArchive("@example/t13-zip-tools", "1.0.0");
        PluginCatalogService.UploadResult first = catalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(zip), compatibility
        );
        assertThat(first.created()).isTrue();

        // 落库的 hash/大小必须描述 CAS 里那份 tgz，而不是上传时的 zip 字节。
        Path stored = artifacts.resolve(first.version().artifactRef(), first.version().sha256());
        byte[] storedBytes = Files.readAllBytes(stored);
        assertThat(HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(storedBytes)
        )).isEqualTo(first.version().sha256());
        assertThat(first.version().sizeBytes()).isEqualTo(storedBytes.length);
        assertThat(storedBytes).isNotEqualTo(zip);
        assertThat(inspector.inspect(stored).packageName()).isEqualTo("@example/t13-zip-tools");

        // 同一份 zip 重复上传必须幂等命中同一行：这正是重写产物字节可复现的价值。
        PluginCatalogService.UploadResult second = catalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(zip), compatibility
        );
        assertThat(second.created()).isFalse();
        assertThat(second.version().id()).isEqualTo(first.version().id());
        assertThat(second.version().sha256()).isEqualTo(first.version().sha256());

        // GitHub "Source code" 包的外层目录必须被剥掉，否则 npm 找不到 package/package.json。
        byte[] wrapped = PluginTestArtifacts.wrappedZipArchive(
            "acme-tools-1.0.0", "@example/t13-github-tools", "1.0.0"
        );
        PluginCatalogService.UploadResult fromGithub = catalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(wrapped), compatibility
        );
        assertThat(fromGithub.created()).isTrue();
        Path githubStored = artifacts.resolve(fromGithub.version().artifactRef(), fromGithub.version().sha256());
        assertThat(inspector.inspect(githubStored).packageName()).isEqualTo("@example/t13-github-tools");

        // 既有规范 tgz 仍走字节透传：上传 hash 必须等于原始字节 hash，历史行身份不被这次改动改写。
        byte[] canonical = PluginTestArtifacts.validArchive("@example/t13-passthrough", "1.0.0");
        PluginCatalogService.UploadResult passthrough = catalog.upload(
            mutation, UUID.randomUUID(), new ByteArrayInputStream(canonical), compatibility
        );
        assertThat(passthrough.version().sha256()).isEqualTo(
            HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical))
        );
        assertThat(Files.readAllBytes(
            artifacts.resolve(passthrough.version().artifactRef(), passthrough.version().sha256())
        )).isEqualTo(canonical);

        // zip 与 tgz 两次上传都不许留下任何 .part 残骸。
        assertDirectoryEmpty(artifactRoot.resolve("tmp"));
    }

    private static List<PluginCatalogService.UploadResult> concurrentUploads(
        PluginCatalogService catalog,
        PluginMutationContext mutation,
        PluginCompatibility compatibility,
        byte[] archive
    ) throws Exception {
        int workers = 6;
        var executor = Executors.newFixedThreadPool(workers);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<PluginCatalogService.UploadResult>> futures = new ArrayList<>();
            for (int index = 0; index < workers; index++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    return catalog.upload(
                        mutation, UUID.randomUUID(), new ByteArrayInputStream(archive), compatibility
                    );
                }));
            }
            start.countDown();
            List<PluginCatalogService.UploadResult> results = new ArrayList<>();
            for (Future<PluginCatalogService.UploadResult> future : futures) results.add(future.get());
            return results;
        } finally {
            executor.shutdownNow();
        }
    }

    private long artifactCount() throws Exception {
        try (Stream<Path> paths = Files.walk(artifactRoot.resolve("sha256"))) {
            return paths.filter(Files::isRegularFile).count();
        }
    }

    private static void assertDirectoryEmpty(Path directory) throws Exception {
        try (Stream<Path> paths = Files.list(directory)) {
            assertThat(paths).isEmpty();
        }
    }

    private static void assertResolved(
        EffectivePluginResolver.ResolvedAssignments resolved,
        long versionId,
        String desiredState
    ) {
        assertThat(resolved.assignments()).singleElement().satisfies(value -> {
            assertThat(value.pluginVersionId()).isEqualTo(versionId);
            assertThat(value.desiredState().name()).isEqualTo(desiredState);
        });
    }

    private static PluginCatalogService.AssignmentSpec spec(
        long versionId,
        PluginAssignment.SubjectType subjectType,
        Long subjectId,
        PluginAssignment.DesiredState desiredState,
        boolean required
    ) {
        return new PluginCatalogService.AssignmentSpec(
            versionId, subjectType, subjectId, desiredState, required
        );
    }

    private static PluginRuntimeService.InventoryObservation observation(
        String packageName,
        String version,
        String sha256,
        long desiredRevision,
        DevicePluginInventory.State state,
        String loaderPhase,
        String lastErrorCode
    ) {
        return new PluginRuntimeService.InventoryObservation(
            packageName, version, sha256, desiredRevision, state, loaderPhase, lastErrorCode, OBSERVED_AT
        );
    }

    private static PluginCompatibility compatibility() {
        return new PluginCompatibility(
            List.of(PluginTestArtifacts.HARNESS_COMMIT),
            ">=0.1.0 <0.2.0",
            List.of("darwin", "linux")
        );
    }

    private static PluginMutationContext mutationContext() {
        return new PluginMutationContext(
            TENANT, ADMIN_USER, "req_01ARZ3NDEKTSV4RRFFQ69G5FAV", "127.0.0.1", new byte[32]
        );
    }

    private static DeviceCallContext runtimeContext(long userId, UUID installation) {
        return new DeviceCallContext(
            TENANT,
            new PlatformSession(userId, PlatformClient.DSH_DESKTOP, "harness", installation.toString()),
            "req_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "127.0.0.1",
            new byte[32]
        );
    }

    private static void insertDevice(long deviceId, long userId, UUID installation, String name) {
        database.jdbc().update("""
            insert into ent_device(
                id,tenant_id,user_id,installation_id,name,platform,harness_version,bundle_version,
                status,last_seen_at,revoked_at,revision
            ) values (?,?,?,?,?,'darwin-arm64','0.1.0-rc.7','0.1.0','ACTIVE',?,null,0)
            """, deviceId, TENANT, userId, installation, name, Timestamp.from(OBSERVED_AT));
    }
}
