/**
 * [INPUT]: 依赖真实 PresetArtifactStore/Inspector、mock 的 PresetStore/AuditSink/revision 端口与直通事务。
 * [OUTPUT]: 锁定发布口引用 fail-closed 的四个错误码、可选引用缺失放行，以及"拒绝时不发生状态迁移"。
 * [POS]: preset/application 的发布门禁单元验收，不依赖 PostgreSQL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.preset.artifact.PresetArtifactInspector;
import com.owndsh.enterprise.preset.artifact.PresetArtifactStore;
import com.owndsh.enterprise.preset.domain.PresetDependency;
import com.owndsh.enterprise.preset.domain.PresetDependencyResolution;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.persistence.PresetStore;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class PresetCatalogServiceDependencyGateTest {
    private static final String TENANT = "000000";
    private static final long ACTOR = 1_900_000_000_000_000_001L;
    private static final long PACKAGE_ID = 1_901_500_000_000_000_001L;
    private static final long VERSION_ID = 1_901_500_000_000_000_101L;
    private static final long TARGET_VERSION_ID = 1_901_500_000_000_000_902L;
    private static final String TARGET_VERSION = Long.toString(TARGET_VERSION_ID);
    private static final String SHA256 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    /** 直通事务：发布口校验不需要真实 DataSource，回调不使用 status，故传 null。 */
    private static final TransactionOperations DIRECT_TRANSACTIONS = new TransactionOperations() {
        @Override
        public <T> T execute(TransactionCallback<T> action) {
            return action.doInTransaction(null);
        }
    };

    private final PresetStore store = mock(PresetStore.class);
    private final AuditSink audit = mock(AuditSink.class);
    private final BootstrapRevisionStore revisions = mock(BootstrapRevisionStore.class);
    private final AtomicLong ids = new AtomicLong(1_902_000_000_000_000_000L);

    @TempDir
    Path temp;

    private PresetCatalogService service;

    @BeforeEach
    void setUp() {
        service = new PresetCatalogService(
            DIRECT_TRANSACTIONS, store, new PresetArtifactStore(temp, 1_048_576L),
            new PresetArtifactInspector(JsonMapper.builder().build(), 1_048_576L, 64),
            revisions, audit, ids::incrementAndGet
        );
    }

    @Test
    void rejectsPublishWhenRequiredReferenceIsMissing() {
        stubValidated(List.of(pinnedSkill(true)));
        when(store.resolveDependency(TENANT, "skill", "expense-reimbursement", TARGET_VERSION))
            .thenReturn(PresetDependencyResolution.MISSING);

        PresetDependencyException exception = assertThrows(
            PresetDependencyException.class, () -> service.publish(context(), VERSION_ID, 0)
        );

        assertEquals(PresetDependencyException.REQUIRES_MISSING, exception.errorCode());
        verify(store, never()).transitionVersion(eq(TENANT), eq(VERSION_ID), any(), any(), anyLong());
    }

    @Test
    void rejectsPublishWhenRequiredReferenceIsNotPublished() {
        stubValidated(List.of(pinnedSkill(true)));
        when(store.resolveDependency(TENANT, "skill", "expense-reimbursement", TARGET_VERSION))
            .thenReturn(PresetDependencyResolution.NOT_PUBLISHED);

        PresetDependencyException exception = assertThrows(
            PresetDependencyException.class, () -> service.publish(context(), VERSION_ID, 0)
        );

        assertEquals(PresetDependencyException.REQUIRES_NOT_PUBLISHED, exception.errorCode());
        verify(store, never()).transitionVersion(eq(TENANT), eq(VERSION_ID), any(), any(), anyLong());
    }

    @Test
    void rejectsPublishWhenDependencyShapeIsInvalid() {
        // 同 kind+id 重复：形状闸必须比解析闸先给出结论，不能先按其中一条去查中心。
        stubValidated(List.of(
            new PresetDependency("skill", "expense-reimbursement", "latest", null, false),
            pinnedSkill(true)
        ));

        PresetDependencyException exception = assertThrows(
            PresetDependencyException.class, () -> service.publish(context(), VERSION_ID, 0)
        );

        assertEquals(PresetDependencyException.DEPENDENCIES_INVALID, exception.errorCode());
        verify(store, never()).resolveDependency(any(), any(), any(), any());
    }

    @Test
    void rejectsPublishWhenDependencyKindIsUnsupported() {
        stubValidated(List.of(
            new PresetDependency("connector", "expense-reimbursement", "latest", null, true)
        ));

        PresetDependencyException exception = assertThrows(
            PresetDependencyException.class, () -> service.publish(context(), VERSION_ID, 0)
        );

        assertEquals(PresetDependencyException.DEPENDENCY_KIND_UNSUPPORTED, exception.errorCode());
        verify(store, never()).resolveDependency(any(), any(), any(), any());
    }

    @Test
    void publishesWhenEveryRequiredReferenceResolves() {
        PresetVersion validated = validated(List.of(
            pinnedSkill(true),
            new PresetDependency("plugin", "@deepseek-ai/dsh-agent-preset", "latest", null, false)
        ));
        when(store.findVersion(TENANT, VERSION_ID))
            .thenReturn(Optional.of(validated), Optional.of(published(validated)));
        when(store.resolveDependency(TENANT, "skill", "expense-reimbursement", TARGET_VERSION))
            .thenReturn(PresetDependencyResolution.RESOLVED);
        when(store.transitionVersion(
            TENANT, VERSION_ID, PresetVersion.Status.VALIDATED, PresetVersion.Status.PUBLISHED, 0
        )).thenReturn(true);

        PresetVersion result = service.publish(context(), VERSION_ID, 0);

        assertEquals(PresetVersion.Status.PUBLISHED, result.status());
        // 可选引用（required=false）不参与解析，也不阻塞发布。
        verify(store, never()).resolveDependency(eq(TENANT), eq("@deepseek-ai/dsh-agent-preset"), any(), any());
        verify(audit).append(any());
    }

    @Test
    void publishesWhenOnlyOptionalReferenceIsMissing() {
        PresetVersion validated = validated(List.of(
            new PresetDependency("skill", "expense-reimbursement", "latest", null, false)
        ));
        when(store.findVersion(TENANT, VERSION_ID))
            .thenReturn(Optional.of(validated), Optional.of(published(validated)));
        when(store.transitionVersion(
            TENANT, VERSION_ID, PresetVersion.Status.VALIDATED, PresetVersion.Status.PUBLISHED, 0
        )).thenReturn(true);

        assertEquals(PresetVersion.Status.PUBLISHED, service.publish(context(), VERSION_ID, 0).status());
        verify(store, never()).resolveDependency(any(), any(), any(), any());
    }

    private void stubValidated(List<PresetDependency> dependencies) {
        when(store.findVersion(TENANT, VERSION_ID)).thenReturn(Optional.of(validated(dependencies)));
    }

    private static PresetDependency pinnedSkill(boolean required) {
        return new PresetDependency("skill", "expense-reimbursement", "pinned", TARGET_VERSION, required);
    }

    private static PresetVersion validated(List<PresetDependency> dependencies) {
        return new PresetVersion(
            VERSION_ID, TENANT, PACKAGE_ID, "0.1.0-rc.7", "sha256/aa", 20480L, SHA256, dependencies,
            PresetVersion.Status.VALIDATED, ACTOR, Instant.parse("2026-09-16T08:00:00Z"), 0
        );
    }

    private static PresetVersion published(PresetVersion version) {
        return new PresetVersion(
            version.id(), version.tenantId(), version.packageId(), version.sourceDshVersion(),
            version.artifactRef(), version.sizeBytes(), version.sha256(), version.dependencies(),
            PresetVersion.Status.PUBLISHED, version.createdBy(), version.createdAt(), version.revision() + 1
        );
    }

    private static PresetMutationContext context() {
        return new PresetMutationContext(TENANT, ACTOR, "req_01K2PRESETGATE0000000000", "127.0.0.1", null);
    }
}
