/**
 * [INPUT]: 依赖 CloudWorkspaceService、内存 WorkspaceStore、真实 AuditSink 替身与临时 bare 仓库根。
 * [OUTPUT]: 验证 slug 规范化/边界、创建事务与审计、bare HEAD、成员权限、禁用开关与创建补偿。
 * [POS]: workspace application 的轻量单测，不替代 PostgreSQL 集成。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.workspace.EnterpriseWorkspaceProperties;
import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;
import com.owndsh.enterprise.workspace.git.GitRepositoryService;
import com.owndsh.enterprise.workspace.persistence.WorkspaceStore;
import org.eclipse.jgit.lib.Repository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionOperations;

import java.nio.file.Files;
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
    void slugifyNormalizesNamesAndRespectsSixtyFourBoundary() {
        assertThat(CloudWorkspaceService.slugify("Team Docs!")).isEqualTo("team-docs");
        assertThat(CloudWorkspaceService.slugify("  你好  ")).isEqualTo("project");
        for (int length = 60; length <= 80; length++) {
            String slug = CloudWorkspaceService.slugify("a".repeat(length));
            assertThat(slug.length()).isLessThanOrEqualTo(64);
            assertThat(slug).matches("^[a-z0-9][a-z0-9-]{0,63}$");
        }
    }

    @Test
    void createInitializesBareWithRequestedHeadAndAuditsOwnerMembership() {
        Fixture fixture = new Fixture(tempDir);
        CloudProject project = fixture.service.create(fixture.context(1L), "Team Docs", "notes");

        assertThat(project.slug()).isEqualTo("team-docs");
        assertThat(fixture.store.members.get(project.id()).get(1L).role())
            .isEqualTo(CloudProjectMember.Role.OWNER);
        assertThat(fixture.audit.actions()).containsExactly(AuditAction.CLOUD_PROJECT_CREATED);
        try (Repository repository = fixture.repositories.open(project.id())) {
            assertThat(repository.getFullBranch()).isEqualTo("refs/heads/main");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    @Test
    void failsCreateBeforeAnyRowOrAuditWhenBareInitializationFails() {
        Fixture fixture = new Fixture(tempDir);
        Path blocked = fixture.repositories.barePath(101L);
        try {
            Files.createDirectories(blocked.getParent());
            Files.writeString(blocked, "not-a-directory");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }

        assertThatThrownBy(() -> fixture.service.create(fixture.context(1L), "Team Docs", null))
            .isInstanceOf(CloudWorkspaceException.class)
            .extracting(error -> ((CloudWorkspaceException) error).errorCode())
            .isEqualTo("ENT_GIT_UNAVAILABLE");

        assertThat(fixture.store.projects).isEmpty();
        assertThat(fixture.store.members).isEmpty();
        assertThat(fixture.audit.events).isEmpty();
    }

    @Test
    void deletesBareDirectoryWhenTransactionFails() {
        Fixture fixture = new Fixture(tempDir);
        fixture.store.failNextProjectInsert = true;

        assertThatThrownBy(() -> fixture.service.create(fixture.context(1L), "Team Docs", null))
            .isInstanceOf(IllegalStateException.class);

        assertThat(fixture.store.projects).isEmpty();
        assertThat(fixture.audit.events).isEmpty();
        assertThat(Files.exists(fixture.repositories.barePath(101L))).isFalse();
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
        assertThat(fixture.audit.actions())
            .containsExactly(AuditAction.CLOUD_PROJECT_CREATED, AuditAction.CLOUD_PROJECT_MEMBER_ADDED);

        assertThatThrownBy(() -> fixture.service.removeMember(fixture.context(1L), project.id(), 1L))
            .isInstanceOf(CloudWorkspaceException.class)
            .extracting(error -> ((CloudWorkspaceException) error).errorCode())
            .isEqualTo("ENT_WORKSPACE_LAST_OWNER");

        fixture.service.removeMember(fixture.context(1L), project.id(), 2L);
        assertThat(fixture.service.listMembers(fixture.context(1L), project.id())).hasSize(1);
        assertThat(fixture.audit.actions()).contains(AuditAction.CLOUD_PROJECT_MEMBER_REMOVED);
    }

    private static final class Fixture {
        private final InMemoryWorkspaceStore store = new InMemoryWorkspaceStore();
        private final RecordingAuditSink audit = new RecordingAuditSink();
        private final EnterpriseWorkspaceProperties properties = new EnterpriseWorkspaceProperties();
        private final GitRepositoryService repositories;
        private final CloudWorkspaceService service;
        private final AtomicLong ids = new AtomicLong(100);

        Fixture(Path root) {
            properties.setEnabled(true);
            properties.setRepoRoot(root);
            repositories = new GitRepositoryService(root);
            service = new CloudWorkspaceService(
                immediateTransactions(), store, repositories, properties, audit, ids::incrementAndGet
            );
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

        private static TransactionOperations immediateTransactions() {
            return new TransactionOperations() {
                @Override
                public <T> T execute(org.springframework.transaction.support.TransactionCallback<T> action) {
                    return action.doInTransaction(new org.springframework.transaction.support.SimpleTransactionStatus());
                }
            };
        }
    }

    private static final class RecordingAuditSink implements AuditSink {
        private final List<AuditEvent> events = new ArrayList<>();

        @Override
        public void append(AuditEvent event) {
            events.add(event);
        }

        List<AuditAction> actions() {
            return events.stream().map(AuditEvent::action).toList();
        }
    }

    private static final class InMemoryWorkspaceStore implements WorkspaceStore {
        private final Map<String, CloudProject> projects = new HashMap<>();
        private final Map<Long, Map<Long, CloudProjectMember>> members = new HashMap<>();
        private boolean failNextProjectInsert;

        @Override
        public boolean slugExists(String tenantId, String slug) {
            return projects.values().stream()
                .anyMatch(value -> value.tenantId().equals(tenantId) && value.slug().equals(slug));
        }

        @Override
        public void insert(CloudProject project) {
            if (failNextProjectInsert) {
                failNextProjectInsert = false;
                throw new IllegalStateException("模拟事务写入失败");
            }
            projects.put(project.tenantId() + ":" + project.id(), project);
        }

        @Override
        public void insertMember(CloudProjectMember member) {
            members.computeIfAbsent(member.projectId(), key -> new HashMap<>()).put(member.userId(), member);
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
        public int deleteProject(String tenantId, long projectId) {
            members.remove(projectId);
            return projects.remove(tenantId + ":" + projectId) == null ? 0 : 1;
        }

        @Override
        public boolean userExists(long userId) {
            return userId > 0;
        }
    }
}
