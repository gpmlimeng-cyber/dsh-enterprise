/**
 * [INPUT]: 依赖 ConnectorStore（DIP 端口）、ConnectorDescriptorGate（声明闸门）、TransactionOperations、AuditSink、JsonMapper 与雪花 ID/Clock。
 * [OUTPUT]: 提供 list / create / update / setStatus / replaceAssignments（全量原子替换 + CAS）与其审计；jsonb 三列的序列化在**这里**（域对象只持正文）。
 * [POS]: connector/application 的管理侧编排；不改任何宿主侧文件，也不持有任何凭据值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.connector.domain.ConnectorAssignment;
import com.owndsh.enterprise.connector.domain.ConnectorEntry;
import com.owndsh.enterprise.connector.persistence.ConnectorStore;
import com.owndsh.enterprise.revision.RevisionConflictException;
import org.springframework.transaction.support.TransactionOperations;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.LongSupplier;

/**
 * 连接器账本的管理侧服务。
 *
 * ### 审计动作映射（这是**口径**，不是随手选的，见方案 §6.5）
 *
 * §6.5 只给了**六类**必须记录的事件（授权授予 / 授权撤销 / 入站接收 / 出站发起 / 被策略拒绝 / 平台不支持），
 * 其中后四类是**运行时**事件（宿主侧连接器发出，见 P0-5/P1）。管理端的写操作因此这样映射：
 *
 * | 管理动作 | action | 为什么 |
 * |---|---|---|
 * | 新建条目 / 置为 ACTIVE | `CONNECTOR_GRANTED` | 这就是"这条连接被授予了"这件事 |
 * | 置为 DISABLED | `CONNECTOR_REVOKED` | 撤销 |
 * | 改字段 / 替换可见范围 | `CONFIG_CHANGED`（**既有**动作） | 方案没给"可见范围替换"第七枚事件；为一个配置变更新造一枚会让封闭枚举失真。配方/技能各自有 `*_ASSIGNMENTS_REPLACED`，那是它们自己的历史，连接器按方案走 |
 *
 * ★ 刻意**不**在这里写任何"出站发起/被拒绝"之类运行时事件：那些只能由真正发起动作的一侧写，
 * 服务端在管理 API 里补一条等于伪造观测。
 */
public final class ConnectorCatalogService {
    private final TransactionOperations transactions;
    private final ConnectorStore connectors;
    private final ConnectorDescriptorGate gate;
    private final AuditSink auditSink;
    private final JsonMapper json;
    private final LongSupplier ids;
    private final Clock clock;

    public ConnectorCatalogService(
        TransactionOperations transactions,
        ConnectorStore connectors,
        ConnectorDescriptorGate gate,
        AuditSink auditSink,
        JsonMapper json,
        LongSupplier ids
    ) {
        this(transactions, connectors, gate, auditSink, json, ids, Clock.systemUTC());
    }

    public ConnectorCatalogService(
        TransactionOperations transactions,
        ConnectorStore connectors,
        ConnectorDescriptorGate gate,
        AuditSink auditSink,
        JsonMapper json,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.connectors = Objects.requireNonNull(connectors, "connectors");
        this.gate = Objects.requireNonNull(gate, "gate");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.json = Objects.requireNonNull(json, "json");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<ConnectorEntry> list(String tenantId, long afterId, int limit) {
        if (limit <= 0) throw new IllegalArgumentException("limit 必须为正数");
        return connectors.list(tenantId, afterId, limit);
    }

    public Optional<ConnectorEntry> find(String tenantId, long id) {
        return connectors.findById(tenantId, id);
    }

    /** 新建一条连接。`connector_id` 撞车由唯一索引兜住（应用侧先查一次只是为了给出更好的错误码）。 */
    public ConnectorEntry create(ConnectorMutationContext context, ConnectorDescriptorGate.Input input) {
        ConnectorDescriptorGate.Validated validated = gate.validate(input);
        if (connectors.findByConnectorId(context.tenantId(), validated.connectorId()).isPresent()) {
            throw ConnectorDeclarationException.invalid("connectorId 在该租户下已存在");
        }
        return requireResult(transactions.execute(status -> {
            Instant now = Instant.now(clock);
            ConnectorEntry entry = new ConnectorEntry(
                positiveId(), context.tenantId(), validated.connectorId(), validated.displayName(),
                validated.summary(), ConnectorEntry.Status.DRAFT, validated.transport(), validated.serverName(),
                json.writeValueAsString(validated.descriptor()),
                json.writeValueAsString(validated.capabilities()),
                json.writeValueAsString(validated.policy()),
                context.actorId(), context.actorId(), now, now, 0
            );
            connectors.insert(entry);
            audit(context, AuditAction.CONNECTOR_GRANTED, entry.id(),
                new ConnectorAuditMetadata.Granted(entry.id(), entry.connectorId(), entry.transport(),
                    validated.capabilities().size()));
            return entry;
        }));
    }

    /** 改字段（身份 `connector_id` 不可改：它是 bundle 落点与审计坐标）。 */
    public ConnectorEntry update(
        ConnectorMutationContext context,
        long id,
        long expectedRevision,
        ConnectorDescriptorGate.Input input
    ) {
        ConnectorDescriptorGate.Validated validated = gate.validate(input);
        return requireResult(transactions.execute(status -> {
            ConnectorEntry current = connectors.findByIdForUpdate(context.tenantId(), id)
                .orElseThrow(ConnectorResourceNotFoundException::new);
            if (!current.connectorId().equals(validated.connectorId())) {
                throw ConnectorDeclarationException.invalid("connectorId 不可修改");
            }
            if (current.revision() != expectedRevision) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            ConnectorEntry updated = current.revised(
                validated.displayName(), validated.summary(), current.status(), validated.transport(),
                validated.serverName(), json.writeValueAsString(validated.descriptor()),
                json.writeValueAsString(validated.capabilities()),
                json.writeValueAsString(validated.policy()),
                context.actorId(), Instant.now(clock)
            );
            if (!connectors.update(updated, expectedRevision)) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            audit(context, AuditAction.CONFIG_CHANGED, id,
                new ConnectorAuditMetadata.Changed(id, updated.connectorId()));
            return connectors.findById(context.tenantId(), id).orElseThrow();
        }));
    }

    /**
     * 置状态。`ACTIVE` 是"这条连接被授予给已分配的范围"，`DISABLED` 是撤销。
     *
     * ★ 刻意**没有** `DELETE`：条目是审计与可见范围的锚，删了会让历史事件指向空气（与资产"只增不删"同一条纪律）。
     */
    public ConnectorEntry setStatus(
        ConnectorMutationContext context,
        long id,
        long expectedRevision,
        ConnectorEntry.Status target
    ) {
        Objects.requireNonNull(target, "target");
        return requireResult(transactions.execute(status -> {
            ConnectorEntry current = connectors.findByIdForUpdate(context.tenantId(), id)
                .orElseThrow(ConnectorResourceNotFoundException::new);
            if (current.status() == target) {
                throw ConnectorDeclarationException.invalid("状态未变化");
            }
            if (current.revision() != expectedRevision) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            ConnectorEntry updated = current.revised(
                current.displayName(), current.summary(), target, current.transport(), current.serverName(),
                current.descriptorJson(), current.capabilitiesJson(), current.policyJson(),
                context.actorId(), Instant.now(clock)
            );
            if (!connectors.update(updated, expectedRevision)) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            ConnectorEntry saved = connectors.findById(context.tenantId(), id).orElseThrow();
            if (target == ConnectorEntry.Status.ACTIVE) {
                audit(context, AuditAction.CONNECTOR_GRANTED, id,
                    new ConnectorAuditMetadata.Granted(id, saved.connectorId(), saved.transport(), 0));
            } else if (target == ConnectorEntry.Status.DISABLED) {
                audit(context, AuditAction.CONNECTOR_REVOKED, id,
                    new ConnectorAuditMetadata.Revoked(id, saved.connectorId(), current.status()));
            } else {
                audit(context, AuditAction.CONFIG_CHANGED, id, new ConnectorAuditMetadata.Changed(id, saved.connectorId()));
            }
            return saved;
        }));
    }

    /**
     * 可见范围**全量原子替换**（禁增量补丁）：先校验整份集合，再在一个事务里删光重插并推进 revision。
     * 与 `PresetCatalogService.replaceAssignments` 同一条纪律，包括"ALL 只能有一条 / USER 不能重复 / 成员必须存在"。
     */
    public List<ConnectorAssignment> replaceAssignments(
        ConnectorMutationContext context,
        long id,
        long expectedRevision,
        List<AssignmentSpec> specs
    ) {
        Objects.requireNonNull(specs, "specs");
        if (specs.size() > 500) throw ConnectorDeclarationException.invalid("可见范围条目超过上限");
        boolean hasAll = false;
        Set<Long> users = new HashSet<>();
        for (AssignmentSpec spec : specs) {
            if (spec.subjectType() == ConnectorAssignment.SubjectType.ALL) {
                if (hasAll) throw ConnectorDeclarationException.invalid("ALL 可见范围只能有一条");
                hasAll = true;
            } else {
                long subjectId = spec.requireSubjectId();
                if (!users.add(subjectId)) throw ConnectorDeclarationException.invalid("USER 可见范围重复");
                if (!connectors.subjectExists(subjectId)) {
                    throw ConnectorDeclarationException.invalid("可见范围成员不存在");
                }
            }
        }
        final boolean all = hasAll;
        final int userCount = users.size();
        return requireResult(transactions.execute(status -> {
            ConnectorEntry current = connectors.findByIdForUpdate(context.tenantId(), id)
                .orElseThrow(ConnectorResourceNotFoundException::new);
            if (current.revision() != expectedRevision) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            connectors.deleteAssignments(context.tenantId(), id);
            List<ConnectorAssignment> inserted = new ArrayList<>();
            if (all) {
                ConnectorAssignment assignment = new ConnectorAssignment(
                    positiveId(), context.tenantId(), id, ConnectorAssignment.SubjectType.ALL, null,
                    ConnectorAssignment.Status.ACTIVE, 0
                );
                connectors.insertAssignment(assignment);
                inserted.add(assignment);
            }
            for (Long userId : users) {
                ConnectorAssignment assignment = new ConnectorAssignment(
                    positiveId(), context.tenantId(), id, ConnectorAssignment.SubjectType.USER, userId,
                    ConnectorAssignment.Status.ACTIVE, 0
                );
                connectors.insertAssignment(assignment);
                inserted.add(assignment);
            }
            if (!connectors.incrementRevision(context.tenantId(), id, expectedRevision)) {
                throw conflict(context.tenantId(), id, expectedRevision);
            }
            audit(context, AuditAction.CONFIG_CHANGED, id, new ConnectorAuditMetadata.Assignments(id, all, userCount));
            return inserted;
        }));
    }

    public List<ConnectorAssignment> listAssignments(String tenantId, long id) {
        return connectors.listAssignments(tenantId, id);
    }

    /** 可见范围条目（web 层 DTO → 领域值的唯一入口）。 */
    public record AssignmentSpec(ConnectorAssignment.SubjectType subjectType, Long subjectId) {
        public AssignmentSpec {
            Objects.requireNonNull(subjectType, "subjectType");
        }

        public long requireSubjectId() {
            if (subjectId == null || subjectId <= 0) {
                throw ConnectorDeclarationException.invalid("USER 可见范围必须携带正 subjectId");
            }
            return subjectId;
        }
    }

    private RevisionConflictException conflict(String tenantId, long id, long expected) {
        long actual = connectors.findById(tenantId, id)
            .map(ConnectorEntry::revision).orElseThrow(ConnectorResourceNotFoundException::new);
        return new RevisionConflictException(expected, actual);
    }

    private void audit(
        ConnectorMutationContext context,
        AuditAction action,
        long resourceId,
        com.owndsh.enterprise.audit.AuditMetadata metadata
    ) {
        auditSink.append(new AuditEvent(
            positiveId(), context.tenantId(), Instant.now(clock), AuditActorType.USER, context.actorId(), null,
            action, "CONNECTOR", Long.toString(resourceId), AuditResult.SUCCESS, null, context.requestId(),
            context.sourceIp(), context.userAgentHash(), metadata
        ));
    }

    private long positiveId() {
        long id = ids.getAsLong();
        if (id <= 0) throw new IllegalStateException("ID 必须为正数");
        return id;
    }

    private static <T> T requireResult(T value) {
        return Objects.requireNonNull(value, "transaction result");
    }
}
