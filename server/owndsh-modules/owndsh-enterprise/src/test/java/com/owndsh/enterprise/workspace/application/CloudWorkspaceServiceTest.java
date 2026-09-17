/**
 * [INPUT]: 依赖 CloudWorkspaceService、内存 WorkspaceStore 与临时 bare 仓库根。
 * [OUTPUT]: 验证 slug 规范化、创建/列表/成员权限、禁用开关与非成员拒绝。
 * [POS]: workspace application 的轻量单测，不替代 PostgreSQL 集成。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.application;

import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.workspace.EnterpriseWorkspaceProperties;
import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;
import com.owndsh.enterprise.workspace.git.GitRepositoryService;
import com.owndsh.enterprise.workspace.persistence.WorkspaceStore;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class CloudWorkspaceServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void slugifyNormalizesNames() {
        assertThat(CloudWorkspaceService.slugify("Team Docs!")).isEqualTo("team-docs");
        assertThat(CloudWorkspaceService.slugify("  你好  ")).isEqualTo("project");
        assertThat(CloudWorkspaceService.slugify("A".repeat(80)).length()).isLessThanOrEqualTo(64);
    }

    @Test
    void createInitializesBareAndOwnerMembership() {
        Fixture fixture = new Fixture(tempDir);
        CloudProject project = fixture.service.create(fixture.context(1L), "Team Docs", "notes");

        assertThat(project.slug()).isEqualTo("team-docs");
        assertThat(fixture.store.members).containsKey(project.id());
        assertThat(fixture.store.members.get(project.id()).get(1L).role())
            .isEqualTo(CloudProjectMember.Role.OWNER);
        assertThat(fixture.repositories.barePath(project.id()).resolve("HEAD")).exists();
    }

    @Test
    void rejectsDisabledWorkspaceAndNonMember() {
        Fixture fixture = new Fixture(tempDir);
        fixture.properties.setEnabled(false);
        assertThatThrownBy(() -> fixture.service.create(fixture.context(1L), "Team Docs", null))
            .isInstanceOf(CloudWorkspaceException.class)
            .extracting(error -> ((CloudWorkspaceException) error).errorCode())
            .isEqualTo("ENT_WORKSPACE_DISABLED");

        fixture.properties.setEnabled(true);
        CloudProject project = fixture.service.create(fixture.context(1L), "Team Docs", null);
        DeviceCallContext outsider = fixture.context(9L);
        assertThatThrownBy(() -> fixture.service.get(outsider, project.id()))
            .isInstanceOf(CloudWorkspaceException.class);
        assertThatThrownBy(() -> fixture.service.authorizeGit("000000", 9L, project.id()))
            .isInstanceOf(CloudWorkspaceException.class);
    }

    @Test
    void ownerCanAddMemberAndCannotRemoveLastOwner() {
        Fixture fixture = new Fixture(tempDir);
        CloudProject project = fixture.service.create(fixture.context(1L), "Team Docs", null);
        fixture.service.addMember(fixture.context(1L), project.id(), 2L);
        assertThat(fixture.service.listMembers(fixture.context(1L), project.id())).hasSize(2);

        assertThatThrownBy(() -> fixture.service.removeMember(fixture.context(1L), project.id(), 1L))
            .isInstanceOf(CloudWorkspaceException.class)
            .extracting(error -> ((CloudWorkspaceException) error).errorCode())
            .isEqualTo("ENT_WORKSPACE_LAST_OWNER");

        fixture.service.removeMember(fixture.context(1L), project.id(), 2L);
        assertThat(fixture.service.listMembers(fixture.context(1L), project.id())).hasSize(1);
    }

    private static final class Fixture {
        private final InMemoryWorkspaceStore store = new InMemoryWorkspaceStore();
        private final EnterpriseWorkspaceProperties properties = new EnterpriseWorkspaceProperties();
        private final GitRepositoryService repositories;
        private final CloudWorkspaceService service;
        private final AtomicLong ids = new AtomicLong(100);

        Fixture(Path root) {
            properties.setEnabled(true);
            properties.setRepoRoot(root);
            repositories = new GitRepositoryService(root);
            service = new CloudWorkspaceService(store, repositories, properties, ids::incrementAndGet);
        }

        DeviceCallContext context(long userId) {
            return new DeviceCallContext(
                "000000",
                new PlatformSession(
                    userId, PlatformClient.DSH_DESKTOP, PlatformClient.DSH_DESKTOP.deviceType(), "device-1"
                ),
                "req_test",
                "127.0.0.1",
                new byte[32]
            );
        }
    }

    private static final class InMemoryWorkspaceStore implements WorkspaceStore {
        private final Map<String, CloudProject> projects = new HashMap<>();
        private final Map<Long, Map<Long, CloudProjectMember>> members = new HashMap<>();

        @Override
        public boolean slugExists(String tenantId, String slug) {
            return projects.values().stream()
                .anyMatch(value -> value.tenantId().equals(tenantId) && value.slug().equals(slug));
        }

        @Override
        public void insert(CloudProject project) {
            projects.put(project.tenantId() + ":" + project.id(), project);
        }

        @Override
        public void insertMember(CloudProjectMember member) {
            members.computeIfAbsent(member.projectId(), key -> new HashMap<>())
                .put(member.userId(), member);
        }

        @Override
        public Optional<CloudProject> findById(String tenantId, long projectId) {
            return Optional.ofNullable(projects.get(tenantId + ":" + projectId));
        }

        @Override
        public Optional<CloudProjectMember> findMembership(String tenantId, long projectId, long userId) {
            return findById(tenantId, projectId)
                .flatMap(project -> Optional.ofNullable(members.getOrDefault(projectId, new HashMap<>()).get(userId)));
        }

        @Override
        public List<CloudProjectMember> listMembers(String tenantId, long projectId) {
            return new ArrayList<>(members.getOrDefault(projectId, new HashMap<>()).values());
        }

        @Override
        public List<CloudProject> listByUser(String tenantId, long userId, long afterId, int limit) {
            return projects.values().stream()
                .filter(value -> value.tenantId().equals(tenantId) && value.id() > afterId)
                .filter(value -> members.getOrDefault(value.id(), new HashMap<>()).containsKey(userId))
                .sorted(java.util.Comparator.comparingLong(CloudProject::id))
                .limit(limit)
                .toList();
        }

        @Override
        public int countOwners(String tenantId, long projectId) {
            return (int) members.getOrDefault(projectId, new HashMap<>()).values().stream()
                .filter(member -> member.role() == CloudProjectMember.Role.OWNER)
                .count();
        }

        @Override
        public int deleteMember(String tenantId, long projectId, long userId) {
            Map<Long, CloudProjectMember> map = members.getOrDefault(projectId, new HashMap<>());
            return map.remove(userId) == null ? 0 : 1;
        }

        @Override
        public boolean userExists(long userId) {
            return userId > 0;
        }
    }
}
