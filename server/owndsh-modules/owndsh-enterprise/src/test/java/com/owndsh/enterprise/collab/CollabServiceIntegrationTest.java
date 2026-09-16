/**
 * [INPUT]: 依赖真实 PostgreSQL、V31 表、CollabService/JdbcCollabStore、JdbcAuditSink 与 DeviceCallContext。
 * [OUTPUT]: 验证开关、建项、邀请、转让、非成员隔离、消息幂等/seq/kind 与审计无正文。
 * [POS]: collab 纵向集成门禁；不覆盖 Controller/SSE HTTP 细节。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab;

import com.owndsh.enterprise.audit.JdbcAuditSink;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.collab.application.CollabException;
import com.owndsh.enterprise.collab.application.CollabService;
import com.owndsh.enterprise.collab.persistence.CollabStore.MessageRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.ProjectRow;
import com.owndsh.enterprise.collab.persistence.JdbcCollabStore;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class CollabServiceIntegrationTest {
    private static final String TENANT = "000000";
    private static final long OWNER = 1913000000000000001L;
    private static final long PEER = 1913000000000000901L;
    private static final AtomicLong SEQUENCE = new AtomicLong(1913900000000000000L);

    private static PostgresTestDatabase.Database database;
    private static CollabService enabled;
    private static CollabService disabled;

    @BeforeAll
    static void setUp() {
        database = PostgresTestDatabase.create("collab_channel");
        PostgresTestDatabase.migrate(database, null);
        PostgresTestDatabase.insertActiveUser(database, PEER, 103L, "collab-peer", "Collab Peer");
        var jdbc = database.jdbc();
        var transactionManager = new DataSourceTransactionManager(database.dataSource());
        var audit = new JdbcAuditSink(jdbc, JsonMapper.builder().build());
        LongSupplier ids = SEQUENCE::incrementAndGet;
        var store = new JdbcCollabStore(jdbc);
        enabled = new CollabService(transactionManager, store, audit, ids, true);
        disabled = new CollabService(transactionManager, store, audit, ids, false);
    }

    @Test
    void disabledRejectsAllProjectWork() {
        assertThatThrownBy(() -> disabled.createProject(runtime(OWNER, "A"), "p"))
            .isInstanceOfSatisfying(CollabException.class, ex ->
                assertThat(ex.errorCode()).isEqualTo("ENT_COLLAB_DISABLED"));
    }

    @Test
    void ownerInvitesTransfersAndPostsMessages() {
        DeviceCallContext owner = runtime(OWNER, "B");
        DeviceCallContext peer = runtime(PEER, "C");
        ProjectRow project = enabled.createProject(owner, "结算对账");
        assertThat(project.ownerUserId()).isEqualTo(OWNER);

        enabled.addMember(owner, project.id(), PEER);
        assertThat(enabled.getProject(peer, project.id()).members()).hasSize(2);

        MessageRow chat = enabled.postMessage(
            peer, project.id(), UUID.randomUUID().toString(), "CHAT", "先对齐口径", null, null
        );
        assertThat(chat.serverSeq()).isZero();
        MessageRow mention = enabled.postMessage(
            peer, project.id(), UUID.randomUUID().toString(), "MENTION", "@owner 看下", "session-1", 3L
        );
        assertThat(mention.serverSeq()).isEqualTo(1);
        assertThat(mention.targetSessionId()).isEqualTo("session-1");

        String idem = UUID.randomUUID().toString();
        MessageRow first = enabled.postMessage(owner, project.id(), idem, "CHAT", "收到", null, null);
        MessageRow replay = enabled.postMessage(owner, project.id(), idem, "CHAT", "收到", null, null);
        assertThat(replay.id()).isEqualTo(first.id());

        assertThatThrownBy(() -> enabled.postMessage(
            peer, project.id(), UUID.randomUUID().toString(), "SYSTEM", "伪造", null, null
        )).isInstanceOfSatisfying(CollabException.class, ex ->
            assertThat(ex.errorCode()).isEqualTo("ENT_INVALID_REQUEST"));

        enabled.transferOwner(owner, project.id(), PEER);
        ProjectRow transferred = enabled.getProject(owner, project.id()).project();
        assertThat(transferred.ownerUserId()).isEqualTo(PEER);
        assertThatThrownBy(() -> enabled.addMember(owner, project.id(), OWNER))
            .isInstanceOfSatisfying(CollabException.class, ex ->
                assertThat(ex.errorCode()).isEqualTo("ENT_PROJECT_NOT_OWNER"));

        DeviceCallContext outsider = runtime(OWNER, "D");
        // OWNER remains a member after transfer; assert a true non-member is rejected as not found.
        long strangerId = 1913000000000000999L;
        PostgresTestDatabase.insertActiveUser(database, strangerId, 103L, "collab-stranger", "Collab Stranger");
        DeviceCallContext stranger = runtime(strangerId, "E");
        assertThatThrownBy(() -> enabled.listMessages(stranger, project.id(), 0, 50))
            .isInstanceOfSatisfying(CollabException.class, ex ->
                assertThat(ex.errorCode()).isEqualTo("ENT_PROJECT_NOT_FOUND"));
        List<MessageRow> messages = enabled.listMessages(outsider, project.id(), 0, 50);
        assertThat(messages).hasSizeGreaterThanOrEqualTo(2);

        Long projectCreated = database.jdbc().queryForObject(
            "select count(*) from ent_audit_event where action='PROJECT_CREATED'",
            Long.class
        );
        assertThat(projectCreated).isGreaterThanOrEqualTo(1);
        Integer withBody = database.jdbc().queryForObject(
            "select count(*) from ent_audit_event where action='COLLAB_MESSAGE_POSTED' "
                + "and metadata_json::text like '%先对齐口径%'",
            Integer.class
        );
        assertThat(withBody).isZero();
    }

    private static DeviceCallContext runtime(long userId, String suffix) {
        return new DeviceCallContext(
            TENANT,
            new PlatformSession(userId, PlatformClient.DSH_DESKTOP, "harness", UUID.randomUUID().toString()),
            "req_01ARZ3NDEKTSV4RRFFQ69G5" + suffix,
            "127.0.0.1",
            new byte[32]
        );
    }
}
