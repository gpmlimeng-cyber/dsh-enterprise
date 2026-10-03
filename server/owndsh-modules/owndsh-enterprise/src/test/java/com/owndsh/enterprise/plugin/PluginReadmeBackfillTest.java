/**
 * [INPUT]: 依赖真实 PluginArtifactStore/PluginArtifactInspector/PluginTestArtifacts 与一个**内存版 PluginStore 替身**
 *          （只实现回填用到的那两条端口，其余一律 UnsupportedOperationException），以及 slf4j 的 LoggerFactory。
 * [OUTPUT]: 对外证明 `PluginReadmeBackfill` 的四条纪律——① 有 README 的存量行**被回填**成归档里的那份文本
 *          （走 CAS：revision 单调 +1）；② 归档里没有 README（或**制品本身丢了**）时**不写、不抛**，只记 warning、
 *          绝不阻断启动；③ **幂等**：已有 README 的行不再出现（`readme is null` 闸）、CAS 失败（并发改过）不计入；
 *          ④ **有界**：`run(limit)` 把上限原样传给扫描，越界上限直接拒。
 * [POS]: 口径 20 上线时「既有那批插件怎么拿到 README」这条路径的机械门禁（本机无 JDK，按静态核对；
 *        远程 `cd server && ./mvnw -pl owndsh-modules/owndsh-enterprise -am test -Dgroups=dev` 复核）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.application.PluginReadmeBackfill;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactStore;
import com.owndsh.enterprise.plugin.domain.DevicePluginInventory;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.PluginPackage;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;
import com.owndsh.enterprise.plugin.persistence.PluginStore;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class PluginReadmeBackfillTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String README = "# 甲的插件\n\n回填用的 README。\n";

    @TempDir
    Path temporary;

    private PluginArtifactInspector inspector() {
        return new PluginArtifactInspector(JSON, 10_000_000L, 100, Set.of("@dshent/core"));
    }

    private PluginArtifactStore artifactStore() {
        return new PluginArtifactStore(temporary.resolve("artifacts"), 52_428_800L);
    }

    private PluginReadmeBackfill backfill(PluginStore store, PluginArtifactStore artifacts) {
        return new PluginReadmeBackfill(
            store, artifacts, inspector(), LoggerFactory.getLogger(PluginReadmeBackfill.class)
        );
    }

    /** 把一个**真的**制品存进 CAS（与上传时同一条落盘路径），返回它的事后事实。 */
    private PluginArtifactStore.StoredArtifact store(PluginArtifactStore artifacts, byte[] tgz) {
        return artifacts.finalizeArtifact(artifacts.writePending(UUID.randomUUID(), new ByteArrayInputStream(tgz)));
    }

    @Test
    void fillsTheReadmeOfStoredVersionsFromTheirOwnArtifact() throws Exception {
        StubStore store = new StubStore();
        PluginArtifactStore artifacts = artifactStore();
        PluginArtifactStore.StoredArtifact stored = store(artifacts,
            PluginTestArtifacts.validArchiveWithFiles("dshent-plugin-readme", "1.0.0", Map.of("README.md", README)));
        store.versions.add(version(idOf(1L), stored.artifactRef(), stored.sha256(), null, 0L));
        PluginReadmeBackfill backfill = backfill(store, artifacts);

        assertThat(backfill.run()).isEqualTo(1);
        assertThat(store.versions.get(0).readme()).isEqualTo(README);
        // 走 CAS：revision 单调 +1（与状态迁移同一套写法）。
        assertThat(store.versions.get(0).revision()).isEqualTo(1L);
        // 幂等：再跑一次，`readme is null` 闸已经把它挡在扫描之外，一条都不动。
        assertThat(backfill.run()).isEqualTo(0);
        assertThat(store.versions.get(0).revision()).isEqualTo(1L);
    }

    @Test
    void skipsVersionsWithoutReadmeOrWithAMissingArtifactWithoutThrowing() throws Exception {
        StubStore store = new StubStore();
        PluginArtifactStore artifacts = artifactStore();
        // ① 归档里**没有** README（正常制品）：保持 null，不算失败、不算回填。
        PluginArtifactStore.StoredArtifact bare = store(artifacts, PluginTestArtifacts.validArchive("dshent-plugin-bare", "1.0.0"));
        store.versions.add(version(idOf(1L), bare.artifactRef(), bare.sha256(), null, 0L));
        // ② 制品**在 CAS 里丢了**（artifact_ref 指向不存在的文件）：只记 warning，绝不抛、绝不阻断启动。
        store.versions.add(version(idOf(2L), "sha256/ff/" + "f".repeat(64) + ".tgz", "f".repeat(64), null, 0L));

        assertThat(backfill(store, artifacts).run()).isZero();
        assertThat(store.versions).allSatisfy(value -> assertThat(value.readme()).isNull());
    }

    @Test
    void isBoundedAndNeverWritesOverAConcurrentChange() throws Exception {
        StubStore store = new StubStore();
        PluginArtifactStore artifacts = artifactStore();
        PluginArtifactStore.StoredArtifact stored = store(artifacts,
            PluginTestArtifacts.validArchiveWithFiles("dshent-plugin-readme", "1.0.0", java.util.Map.of("README.md", README)));
        for (long sequence = 1L; sequence <= 3L; sequence++) {
            store.versions.add(version(idOf(sequence), stored.artifactRef(), stored.sha256(), null, 0L));
        }
        PluginReadmeBackfill backfill = backfill(store, artifacts);

        // ④ 有界：run(1) 把上限**原样**传给扫描——只处理一行，其余留给下一轮。
        assertThat(backfill.run(1)).isEqualTo(1);
        assertThat(store.scannedLimit).isEqualTo(1);
        assertThat(store.versions.get(0).readme()).isEqualTo(README);
        assertThat(store.versions.get(1).readme()).isNull();

        // ③ CAS：第 2 条被模拟成「扫描之后、写回之前被并发改过」⇒ 不写、不计入，第 3 条照旧补上。
        store.casConflicts.add(idOf(2L));
        assertThat(backfill.run(10)).isEqualTo(1);
        assertThat(store.versions.get(1).readme()).isNull();
        assertThat(store.versions.get(2).readme()).isEqualTo(README);

        // 越界上限直接拒（这是**编程错误**，不是数据问题）。
        assertThatThrownBy(() -> backfill.run(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> backfill.run(10_001)).isInstanceOf(IllegalArgumentException.class);
    }

    /** 测试里的第 n 条版本行 id（雪花形态、恰好为正）。 */
    private static long idOf(long sequence) {
        return 1_901_300_000_000_000_800L + sequence;
    }

    private static PluginVersion version(long id, String artifactRef, String sha256, String readme, long revision) {
        return new PluginVersion(
            id, "000000", 1_901_300_000_000_000_502L, "@example/backfill", "1.0.0",
            artifactRef, readme, 4096L, sha256, new byte[64],
            new PluginCompatibility(
                List.of(PluginTestArtifacts.HARNESS_COMMIT), ">=0.1.0 <0.2.0", List.of("darwin", "linux")
            ),
            PluginVersion.Status.PUBLISHED, 1L, Instant.parse("2026-08-19T03:00:00Z"), revision
        );
    }

    /**
     * 内存版 PluginStore 替身：**只**实现回填用到的那两条端口（扫描 + CAS 写回），其余一律
     * `UnsupportedOperationException` —— 替身一旦被别的路径用到就会当场炸，不会静默给出假事实。
     *
     * <p>`casConflicts` 装的是**版本行 id**（不是序号），模拟「扫描之后、写回之前那一行被并发改过」：
     * 那一条会被 CAS 拒掉（返回 false、不写），正是真实 `update ... where revision=?` 在那种情形下的行为。
     */
    private static final class StubStore implements PluginStore {
        private final List<PluginVersion> versions = new ArrayList<>();
        private final Set<Long> casConflicts = new HashSet<>();
        private int scannedLimit = -1;

        @Override
        public List<PluginVersion> findVersionsMissingReadme(int limit) {
            scannedLimit = limit;
            List<PluginVersion> pending = new ArrayList<>();
            for (PluginVersion value : versions) {
                if (value.readme() == null && pending.size() < limit) pending.add(value);
            }
            return pending;
        }

        @Override
        public boolean updateVersionReadme(String tenantId, long versionId, String readme, long expectedRevision) {
            if (casConflicts.contains(versionId)) return false;
            for (int index = 0; index < versions.size(); index++) {
                PluginVersion value = versions.get(index);
                if (value.id() != versionId || value.readme() != null || value.revision() != expectedRevision) continue;
                versions.set(index, version(value.id(), value.artifactRef(), value.sha256(), readme, value.revision() + 1));
                return true;
            }
            return false;
        }

        @Override
        public Optional<PluginPackage> findPackageByNameForUpdate(String tenantId, String packageName) {
            throw new UnsupportedOperationException("回填不该碰 package");
        }

        @Override
        public Optional<PluginPackage> findPackageById(String tenantId, long packageId) {
            throw new UnsupportedOperationException("回填不该碰 package");
        }

        @Override
        public Optional<PluginPackage> findPackageByIdForUpdate(String tenantId, long packageId) {
            throw new UnsupportedOperationException("回填不该碰 package");
        }

        @Override
        public List<PluginPackage> listPackages(String tenantId, long afterId, int limit) {
            throw new UnsupportedOperationException("回填不该碰 package");
        }

        @Override
        public void insertPackage(PluginPackage pluginPackage) {
            throw new UnsupportedOperationException("回填不建 package");
        }

        @Override
        public boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision) {
            throw new UnsupportedOperationException("回填不动 package revision");
        }

        @Override
        public Optional<PluginVersion> findExistingVersion(
            String tenantId, String packageName, String version, String sha256
        ) {
            throw new UnsupportedOperationException("回填不走上传幂等");
        }

        @Override
        public Optional<PluginVersion> findVersion(String tenantId, long versionId) {
            throw new UnsupportedOperationException("回填只按扫描结果逐条处理");
        }

        @Override
        public List<PluginVersion> listVersions(String tenantId, long packageId) {
            throw new UnsupportedOperationException("回填不列版本");
        }

        @Override
        public void insertVersion(PluginVersion version) {
            throw new UnsupportedOperationException("回填不插版本");
        }

        @Override
        public boolean transitionVersion(
            String tenantId, long versionId, PluginVersion.Status from, PluginVersion.Status to, long expectedRevision
        ) {
            throw new UnsupportedOperationException("回填不改版本状态");
        }

        @Override
        public List<PluginAssignment> listAssignments(String tenantId, long packageId) {
            throw new UnsupportedOperationException("回填不碰分配");
        }

        @Override
        public void deleteAssignments(String tenantId, long packageId) {
            throw new UnsupportedOperationException("回填不碰分配");
        }

        @Override
        public void insertAssignment(PluginAssignment assignment) {
            throw new UnsupportedOperationException("回填不碰分配");
        }

        @Override
        public boolean subjectExists(PluginAssignment.SubjectType subjectType, long subjectId) {
            throw new UnsupportedOperationException("回填不碰主体");
        }

        @Override
        public List<RuntimePluginAssignment> findEffectiveAssignments(
            String tenantId, long userId, Long departmentId
        ) {
            throw new UnsupportedOperationException("回填不走生效查询");
        }

        @Override
        public void replaceInventory(String tenantId, long deviceId, List<DevicePluginInventory> inventory) {
            throw new UnsupportedOperationException("回填不碰库存");
        }

        @Override
        public List<DevicePluginInventory> listInventory(String tenantId, long afterId, int limit) {
            throw new UnsupportedOperationException("回填不碰库存");
        }
    }
}
