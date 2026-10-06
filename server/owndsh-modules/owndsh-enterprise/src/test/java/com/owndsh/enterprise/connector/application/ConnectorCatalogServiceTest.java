/**
 * [INPUT]: 依赖 ConnectorCatalogService、mock 的 ConnectorStore/AuditSink 与直通事务。
 * [OUTPUT]: 锁定管理编排的每一档：新建即授予、状态迁移的两枚审计动作与"未变化即拒"、CAS 冲突、身份不可改、可见范围全量替换（含 ALL/USER 不变式与成员存在性）。
 * [POS]: connector/application 的单元验收，不依赖 PostgreSQL 与 Spring 容器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.connector.domain.ConnectorAssignment;
import com.owndsh.enterprise.connector.domain.ConnectorEntry;
import com.owndsh.enterprise.connector.persistence.ConnectorStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class ConnectorCatalogServiceTest {
    private static final long CONNECTOR_ID = 1_904_400_000_000_000_001L;
    private static final Instant NOW = Instant.parse("2026-10-06T00:00:00Z");

    /** 直通事务：编排语义不需要真实 DataSource，回调不使用 status，故传 null。 */
    private static final TransactionOperations DIRECT_TRANSACTIONS = new TransactionOperations() {
        @Override
        public <T> T execute(TransactionCallback<T> action) {
            return action.doInTransaction(null);
        }
    };

    private final ConnectorStore store = mock(ConnectorStore.class);
    private final AuditSink audit = mock(AuditSink.class);
    private final AtomicLong ids = new AtomicLong(CONNECTOR_ID);
    private final ConnectorMutationContext context =
        new ConnectorMutationContext("t-1", 1_900_000_000_000_000_001L, "req-1", "127.0.0.1", null);

    private ConnectorCatalogService service;

    @BeforeEach
    void setUp() {
        service = new ConnectorCatalogService(
            DIRECT_TRANSACTIONS, store, new ConnectorDescriptorGate(), audit,
            JsonMapper.builder().build(), ids::incrementAndGet, Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    @Test
    void createInsertsADraftEntryAndAuditsAGrant() {
        when(store.findByConnectorId("t-1", "ent-demo")).thenReturn(Optional.empty());

        ConnectorEntry created = service.create(context, input("ent-demo"));

        assertEquals(ConnectorEntry.Status.DRAFT, created.status());
        assertEquals("{\"maxLevel\":\"L2\"}", created.policyJson());
        assertTrue(created.descriptorJson().contains("\"command\":\"npx\""));
        assertEquals(0, created.revision());
        verify(store).insert(created);
        assertEquals(AuditAction.CONNECTOR_GRANTED, capturedAction());
    }

    @Test
    void createRejectsADuplicateConnectorIdBeforeTouchingTheStore() {
        when(store.findByConnectorId("t-1", "ent-demo"))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 0)));

        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class,
            () -> service.create(context, input("ent-demo")));

        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
        verify(store, never()).insert(any());
    }

    @Test
    void updateRejectsAStaleRevision() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 3)));
        when(store.findById("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 3)));

        assertThrows(RevisionConflictException.class, () -> service.update(context, CONNECTOR_ID, 2, input("ent-demo")));
        verify(store, never()).update(any(), anyLong());
    }

    @Test
    void updateKeepsTheIdentityImmutable() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 0)));

        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class,
            () -> service.update(context, CONNECTOR_ID, 0, input("ent-other")));

        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void updateWritesTheRevisedEntryAndAuditsAConfigChange() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 0)));
        when(store.update(any(), eq(0L))).thenReturn(true);
        when(store.findById("t-1", CONNECTOR_ID))
            .thenAnswer(invocation -> Optional.of(entry(ConnectorEntry.Status.DRAFT, 1)));

        service.update(context, CONNECTOR_ID, 0, input("ent-demo"));

        assertEquals(AuditAction.CONFIG_CHANGED, capturedAction());
    }

    @Test
    void activationAndDisablingUseTheTwoGrantAuditActions() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.DRAFT, 0)));
        when(store.update(any(), anyLong())).thenReturn(true);
        when(store.findById("t-1", CONNECTOR_ID))
            .thenAnswer(invocation -> Optional.of(entry(ConnectorEntry.Status.ACTIVE, 1)));

        service.setStatus(context, CONNECTOR_ID, 0, ConnectorEntry.Status.ACTIVE);
        assertEquals(AuditAction.CONNECTOR_GRANTED, capturedAction());

        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.ACTIVE, 1)));
        when(store.findById("t-1", CONNECTOR_ID))
            .thenAnswer(invocation -> Optional.of(entry(ConnectorEntry.Status.DISABLED, 2)));
        service.setStatus(context, CONNECTOR_ID, 1, ConnectorEntry.Status.DISABLED);
        assertEquals(AuditAction.CONNECTOR_REVOKED, capturedAction());
    }

    @Test
    void aNoOpStatusChangeIsRejected() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.ACTIVE, 0)));

        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class,
            () -> service.setStatus(context, CONNECTOR_ID, 0, ConnectorEntry.Status.ACTIVE));

        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
        verify(store, never()).update(any(), anyLong());
    }

    @Test
    void replaceAssignmentsDeletesThenInsertsTheWholeSet() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.ACTIVE, 0)));
        when(store.incrementRevision("t-1", CONNECTOR_ID, 0)).thenReturn(true);
        when(store.subjectExists(anyLong())).thenReturn(true);

        List<ConnectorAssignment> inserted = service.replaceAssignments(context, CONNECTOR_ID, 0, List.of(
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.ALL, null),
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.USER, 42L)
        ));

        assertEquals(2, inserted.size());
        verify(store).deleteAssignments("t-1", CONNECTOR_ID);
        verify(store, org.mockito.Mockito.times(2)).insertAssignment(any());
        assertEquals(AuditAction.CONFIG_CHANGED, capturedAction());
    }

    @Test
    void replaceAssignmentsRejectsDuplicateAllAndDuplicateUsers() {
        assertThrows(ConnectorDeclarationException.class, () -> service.replaceAssignments(context, CONNECTOR_ID, 0, List.of(
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.ALL, null),
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.ALL, null)
        )));
        assertThrows(ConnectorDeclarationException.class, () -> service.replaceAssignments(context, CONNECTOR_ID, 0, List.of(
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.USER, 42L),
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.USER, 42L)
        )));
        verify(store, never()).deleteAssignments(any(), anyLong());
    }

    @Test
    void replaceAssignmentsRejectsAnUnknownMember() {
        when(store.subjectExists(anyLong())).thenReturn(false);

        assertThrows(ConnectorDeclarationException.class, () -> service.replaceAssignments(context, CONNECTOR_ID, 0, List.of(
            new ConnectorCatalogService.AssignmentSpec(ConnectorAssignment.SubjectType.USER, 42L)
        )));
        verify(store, never()).deleteAssignments(any(), anyLong());
    }

    @Test
    void replaceAssignmentsOnAStaleRevisionConflicts() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.ACTIVE, 5)));
        when(store.findById("t-1", CONNECTOR_ID))
            .thenReturn(Optional.of(entry(ConnectorEntry.Status.ACTIVE, 5)));

        assertThrows(RevisionConflictException.class, () -> service.replaceAssignments(context, CONNECTOR_ID, 4, List.of()));
    }

    @Test
    void aMissingConnectorIsReportedAsResourceNotFound() {
        when(store.findByIdForUpdate("t-1", CONNECTOR_ID)).thenReturn(Optional.empty());

        assertThrows(ConnectorResourceNotFoundException.class,
            () -> service.setStatus(context, CONNECTOR_ID, 0, ConnectorEntry.Status.ACTIVE));
    }

    private AuditAction capturedAction() {
        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(audit, org.mockito.Mockito.atLeastOnce()).append(captor.capture());
        return captor.getValue().action();
    }

    private ConnectorEntry entry(ConnectorEntry.Status status, long revision) {
        return new ConnectorEntry(
            CONNECTOR_ID, "t-1", "ent-demo", "示例连接器", null, status, ConnectorEntry.Transport.MCP,
            "ent-demo", "{\"transport\":\"stdio\",\"command\":\"npx\"}", "[{}]", "{\"maxLevel\":\"L2\"}",
            1L, 1L, NOW, NOW, revision
        );
    }

    private ConnectorDescriptorGate.Input input(String connectorId) {
        Map<String, Object> descriptor = new LinkedHashMap<>();
        descriptor.put("transport", "stdio");
        descriptor.put("command", "npx");
        Map<String, Object> capability = new LinkedHashMap<>();
        capability.put("capabilityId", "ent-demo-read");
        capability.put("title", "示例只读能力");
        capability.put("stateAddress", Map.of("kind", "resource", "path", "documents/readme"));
        capability.put("effects", List.of("read"));
        capability.put("reversibility", "reversible");
        capability.put("blastRadius", "self");
        capability.put("transport", "mcp");
        capability.put("platformRequired", List.of(Map.of("platform", "android", "support", "supported")));
        capability.put("discovery", List.of("catalog"));
        return new ConnectorDescriptorGate.Input(
            connectorId, "示例连接器", null, ConnectorEntry.Transport.MCP, "ent-demo",
            descriptor, List.of(capability), Map.of("maxLevel", "L2")
        );
    }
}
